// deno-lint-ignore-file no-console

import {
  type AuthorReadRouteContext,
  type AuthorRelaysContext,
  createPublicKey,
  type Event,
  KIND_SHORT_NOTE,
  normaliseRelayUrl,
  type PublicKey,
  type PublishContext,
  type RelayHintContext,
  type RelayUrl,
  routeAuthorReads,
  routePublish,
  selectAuthorDmRelays,
  selectAuthorInboxRelays,
  selectAuthorOutboxRelays,
  selectRelayHint,
} from "./mod.ts"

const relayUrl = (raw: string): RelayUrl => {
  const url = normaliseRelayUrl(raw)
  if (!url) throw new Error(`Invalid relay URL: ${raw}`)
  return url
}

const publicKey = (raw: string): PublicKey => {
  const pk = createPublicKey(raw)
  if (!pk) throw new Error(`Invalid pubkey: ${raw}`)
  return pk
}

interface RawFixture {
  readonly name: string
  readonly pubkey: string
  readonly events: ReadonlyArray<Event>
}

interface RealWorldFixture {
  readonly name: string
  readonly pubkey: PublicKey
  readonly events: ReadonlyArray<Event>
}

const isRawFixture = (value: unknown): value is RawFixture => {
  if (typeof value !== "object" || value === null) return false
  if (!("name" in value) || typeof value.name !== "string") return false
  if (!("pubkey" in value) || typeof value.pubkey !== "string") return false
  if (!("events" in value) || !Array.isArray(value.events)) return false
  return true
}

const loadAuthors = (): ReadonlyArray<RealWorldFixture> => {
  const dir = new URL("./tests/corpus/real-world/", import.meta.url)
  const fixtures: Array<RealWorldFixture> = []
  for (const entry of Deno.readDirSync(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue
    const text = Deno.readTextFileSync(new URL(entry.name, dir))
    const raw: unknown = JSON.parse(text)
    if (!isRawFixture(raw)) throw new Error(`Fixture ${entry.name} is not a valid RawFixture`)
    fixtures.push({
      name: raw.name,
      pubkey: publicKey(raw.pubkey),
      events: raw.events,
    })
  }
  fixtures.sort((a, b) => a.name.localeCompare(b.name))
  return fixtures
}

const printSection = (title: string): void => {
  console.log(`\n=== ${title} ===\n`)
}

const printRelays = (label: string, relays: ReadonlyArray<RelayUrl> | null): void => {
  if (relays === null) {
    console.log(`  ${label}: (null, no fallback)`)
    return
  }
  if (relays.length === 0) {
    console.log(`  ${label}: (none)`)
    return
  }
  console.log(`  ${label}:`)
  for (const url of relays) console.log(`    - ${url}`)
}

const authorName = (pubkey: PublicKey, authors: ReadonlyArray<RealWorldFixture>): string => {
  const match = authors.find((a) => a.pubkey === pubkey)
  return match?.name ?? `${pubkey.slice(0, 8)}...`
}

const authors = loadAuthors()
const byName = new Map(authors.map((a) => [a.name, a]))
const allRelayListEvents = authors.flatMap((a) => [...a.events])

const derek = byName.get("Derek Ross")
const fiatjaf = byName.get("fiatjaf")
const pablo = byName.get("PABLOF7z")
if (!derek || !fiatjaf || !pablo) throw new Error("expected real-world fixtures missing")

printSection("Per-author relay extraction (selectAuthor* functions)")

for (const author of authors) {
  console.log(`${author.name} ${author.pubkey.slice(0, 8)}...`)
  const context: AuthorRelaysContext = {
    authorPubkey: author.pubkey,
    relayListEvents: author.events,
  }
  printRelays("inbox", selectAuthorInboxRelays(context))
  printRelays("outbox", selectAuthorOutboxRelays(context))
  printRelays("dm", selectAuthorDmRelays(context))
  console.log()
}

printSection("Publish routing (routePublish)")
console.log("Derek posts a kind 1 note p-tagging fiatjaf and PABLOF7z.")
console.log("Result fans out across Derek's outbox + recipient inboxes (capped at 3 per recipient).")

const kind1: Event = {
  kind: KIND_SHORT_NOTE,
  pubkey: derek.pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["p", fiatjaf.pubkey],
    ["p", pablo.pubkey],
  ],
}

const publishContext: PublishContext = {
  userPubkey: derek.pubkey,
  relayListEvents: allRelayListEvents,
  privateContentRelays: [],
  indexerRelays: [],
}

const publishRoute = routePublish(kind1, publishContext)
console.log(`  branch: ${publishRoute.branch}`)
printRelays("publish to", publishRoute.relays)

printSection("Author-set-cover routing (routeAuthorReads)")
console.log("Reading notes from all four authors. Greedy set-cover picks the")
console.log("smallest number of relays that reach every author with the configured")
console.log("redundancy (default 3).\n")

const readContext: AuthorReadRouteContext = {
  authorPubkeys: authors.map((a) => a.pubkey),
  relayListEvents: allRelayListEvents,
  fallbackRelays: [relayUrl("wss://relay.damus.io/"), relayUrl("wss://nos.lol/")],
}

const routes = routeAuthorReads(readContext)
routes.forEach((route, i) => {
  console.log(`  Route ${i + 1}:`)
  console.log(`    relays: ${route.relays.join(", ")}`)
  for (const chunk of route.authorChunks) {
    const names = chunk.map((pk) => authorName(pk, authors))
    console.log(`    authors: ${names.join(", ")}`)
  }
  console.log()
})

printSection("Relay hint selection (selectRelayHint)")
console.log("Derek wants to reference a fiatjaf post via an e-tag. Which relay URL")
console.log("to attach as the hint? The lib prefers the intersection of Derek's")
console.log("outbox with fiatjaf's inbox, falling back to either side's first relay.\n")

const hintContext: RelayHintContext = {
  targetPubkey: fiatjaf.pubkey,
  userPubkey: derek.pubkey,
  relayListEvents: allRelayListEvents,
}

const hint = selectRelayHint(hintContext)
console.log(`  hint: ${hint ?? "(none)"}`)
