import {
  createEvent,
  createPublicKey,
  createRelayDirectory,
  type Event,
  type NoDmRelaysFailure,
  normaliseRelayUrl,
  type PublicKey,
  type PublishRoute,
  type ReadRoute,
  recipientsWithoutInbox,
  routeAuthorReads,
  routePublish,
  routeRead,
  selectRelayHint,
} from "../mod.ts"

const ALICE = "a".repeat(64)
const BOB = "b".repeat(64)
const CAROL = "c".repeat(64)
const NAMES: Readonly<Record<string, string>> = { [ALICE]: "alice", [BOB]: "bob", [CAROL]: "carol" }

const requirePublicKey = (hex: string): PublicKey => {
  const pubkey = createPublicKey(hex)
  if (pubkey === null) throw new Error(`not a valid pubkey: ${hex}`)
  return pubkey
}

const parseEvent = (raw: unknown): Event => {
  const event = createEvent(raw)
  if (event === null) throw new Error(`not a valid event: ${JSON.stringify(raw)}`)
  return event
}

const wireRelayLists: ReadonlyArray<unknown> = [
  {
    id: "1".repeat(64),
    kind: 10002,
    pubkey: ALICE,
    created_at: 1700000000,
    tags: [["r", "wss://alice-write.example.com", "write"], ["r", "wss://shared.example.com"]],
  },
  {
    id: "2".repeat(64),
    kind: 10002,
    pubkey: BOB,
    created_at: 1700000000,
    tags: [["r", "WSS://Bob-Inbox.example.com/", "read"], ["r", "wss://shared.example.com"]],
  },
  {
    id: "3".repeat(64),
    kind: 10050,
    pubkey: BOB,
    created_at: 1700000000,
    tags: [["relay", "wss://bob-dm.example.com"]],
  },
]

const blocked = [normaliseRelayUrl("wss://spam.example.com")].filter((url) => url !== null)
const directory = createRelayDirectory(wireRelayLists.map(parseEvent), blocked)

const describe = (result: PublishRoute | ReadRoute | NoDmRelaysFailure): string =>
  "failure" in result ? `refused (${result.failure})` : `${result.branch}: ${result.relays.join(", ") || "(none)"}`

const note = parseEvent({
  id: "4".repeat(64),
  kind: 1,
  pubkey: ALICE,
  created_at: 1700000100,
  tags: [["p", BOB], ["p", CAROL, "wss://carol-hint.example.com"]],
})

console.log("Alice replies to Bob and Carol (kind 1):")
console.log(`  ${describe(routePublish(note, directory))}`)
console.log(
  `  recipients without an inbox: ${recipientsWithoutInbox(note, directory).map((pk) => NAMES[pk]).join(", ")}`,
)

const followList = parseEvent({
  id: "6".repeat(64),
  kind: 3,
  pubkey: ALICE,
  created_at: 1700000150,
  tags: [["p", BOB], ["p", CAROL, "wss://carol-hint.example.com"]],
})

console.log("\nAlice follows Bob and Carol (kind 3: its p tags are data, not mentions):")
console.log(`  ${describe(routePublish(followList, directory))}`)

const giftWrapTo = (recipient: string): Event =>
  parseEvent({
    id: "5".repeat(64),
    kind: 1059,
    pubkey: "e".repeat(64),
    created_at: 1700000200,
    tags: [["p", recipient]],
  })

console.log("\nA gift-wrapped DM (kind 1059):")
console.log(`  to bob:   ${describe(routePublish(giftWrapTo(BOB), directory))}`)
console.log(`  to carol: ${describe(routePublish(giftWrapTo(CAROL), directory))}`)

const alice = requirePublicKey(ALICE)
const bob = requirePublicKey(BOB)
const carol = requirePublicKey(CAROL)

console.log("\nAlice reads her general feed:")
console.log(`  ${describe(routeRead([{ kinds: [1] }], directory, { userPubkey: alice }))}`)

console.log("\nAlice reads replies to Bob (#p bob):")
console.log(`  ${describe(routeRead([{ kinds: [1], "#p": [bob] }], directory, { userPubkey: alice }))}`)

const fallbackRelays = [normaliseRelayUrl("wss://fallback.example.com")].filter((url) => url !== null)
const authors = [alice, bob, carol]
console.log("\nReading notes by alice, bob and carol (one relay each):")
for (const route of routeAuthorReads(authors, directory, { fallbackRelays, redundancy: 1 })) {
  const names = route.authorChunks.flat().map((pk) => NAMES[pk])
  console.log(`  ${route.relays.join(", ")} <- ${names.join(", ")}`)
}

console.log(
  `\nRelay hint for a p tag to bob, or an e tag to a note by bob: ${
    selectRelayHint(alice, { pubkey: bob }, directory)
  }`,
)
const seenOn = normaliseRelayUrl("wss://seen.example.com")
if (seenOn !== null) {
  const hint = selectRelayHint(alice, { pubkey: bob, seenOn }, directory)
  console.log(`Relay hint for an e tag to a note by bob, seen on ${seenOn}: ${hint}`)
}
