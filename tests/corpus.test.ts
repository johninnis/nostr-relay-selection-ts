import { assertEquals } from "@std/assert"
import {
  type AuthorReadRouteContext,
  type AuthorRelaysContext,
  buildRelaySet,
  createEvent,
  createFilter,
  type Event,
  extractBlockedRelayUrls,
  extractDmRelayUrls,
  extractInboxRelayUrls,
  extractOutboxRelayUrls,
  extractSearchRelayUrls,
  type Filter,
  findFilterPattern,
  isInsecureUrl,
  isLocalAddrUrl,
  isLoopbackUrl,
  isOnionUrl,
  missingRelayListPubkeys,
  normaliseRelayUrl,
  type PublishContext,
  type ReadContext,
  type RelayHintContext,
  type RelayUrl,
  routeAuthorReads,
  routePublish,
  routeRead,
  selectAuthorInboxRelays,
  selectRelayHint,
  selectZapRequestRelays,
  type ZapRequestContext,
} from "../mod.ts"

const loadCorpus = <T>(filename: string): ReadonlyArray<T> => {
  const url = new URL(`./corpus/${filename}`, import.meta.url)
  const text = Deno.readTextFileSync(url)
  // deno-lint-ignore innis/no-type-assertions
  return JSON.parse(text) as ReadonlyArray<T>
}

interface NormaliseVector {
  readonly name: string
  readonly input: string | null
  readonly expected: string | null
}

const normaliseVectors = loadCorpus<NormaliseVector>("normalise-url.json")

for (const v of normaliseVectors) {
  Deno.test(`corpus: normaliseRelayUrl — ${v.name}`, () => {
    assertEquals(normaliseRelayUrl(v.input), v.expected)
  })
}

Deno.test("corpus: normaliseRelayUrl is idempotent for every vector", () => {
  for (const v of normaliseVectors) {
    if (v.expected === null) continue
    assertEquals(normaliseRelayUrl(v.expected), v.expected, `idempotency failed for ${v.name}`)
  }
})

interface BuildSetVector {
  readonly name: string
  readonly input: ReadonlyArray<ReadonlyArray<string>>
  readonly expected: ReadonlyArray<string>
}

for (const v of loadCorpus<BuildSetVector>("build-relay-set.json")) {
  Deno.test(`corpus: buildRelaySet — ${v.name}`, () => {
    assertEquals([...buildRelaySet(...v.input)], [...v.expected])
  })
}

interface ExtractVector {
  readonly function:
    | "extractInboxRelayUrls"
    | "extractOutboxRelayUrls"
    | "extractDmRelayUrls"
    | "extractBlockedRelayUrls"
    | "extractSearchRelayUrls"
  readonly name: string
  readonly tags: ReadonlyArray<ReadonlyArray<string>>
  readonly expected: ReadonlyArray<string>
}

const extractors: Record<
  ExtractVector["function"],
  (tags: ReadonlyArray<ReadonlyArray<string>>) => ReadonlyArray<RelayUrl>
> = {
  extractInboxRelayUrls,
  extractOutboxRelayUrls,
  extractDmRelayUrls,
  extractBlockedRelayUrls,
  extractSearchRelayUrls,
}

for (const v of loadCorpus<ExtractVector>("extract-relay-urls.json")) {
  Deno.test(`corpus: ${v.function} — ${v.name}`, () => {
    assertEquals([...extractors[v.function](v.tags)], [...v.expected])
  })
}

interface RoutePublishVector {
  readonly name: string
  readonly event: Event
  readonly context: PublishContext
  readonly expected: {
    readonly branch: "general" | "dm" | "draft"
    readonly relays: ReadonlyArray<string> | null
  }
}

for (const v of loadCorpus<RoutePublishVector>("route-publish.json")) {
  Deno.test(`corpus: routePublish — ${v.name}`, () => {
    const route = routePublish(v.event, v.context)
    assertEquals(route.branch, v.expected.branch)
    const actualRelays = route.relays === null ? null : [...route.relays]
    const expectedRelays = v.expected.relays === null ? null : [...v.expected.relays]
    assertEquals(actualRelays, expectedRelays)
  })
}

interface FindFilterPatternVector {
  readonly name: string
  readonly filters: ReadonlyArray<Filter>
  readonly expected: "search" | "dmInbox" | "general"
}

for (const v of loadCorpus<FindFilterPatternVector>("find-filter-pattern.json")) {
  Deno.test(`corpus: findFilterPattern — ${v.name}`, () => {
    assertEquals(findFilterPattern(v.filters), v.expected)
  })
}

interface ClassifyUrlVector {
  readonly name: string
  readonly input: string
  readonly isOnion: boolean
  readonly isLoopback: boolean
  readonly isLocalAddr: boolean
  readonly isInsecure: boolean
}

for (const v of loadCorpus<ClassifyUrlVector>("classify-url.json")) {
  Deno.test(`corpus: classify-url — ${v.name}`, () => {
    const url = normaliseRelayUrl(v.input)
    if (url === null) throw new Error(`expected ${v.input} to parse`)
    assertEquals(isOnionUrl(url), v.isOnion, "isOnion")
    assertEquals(isLoopbackUrl(url), v.isLoopback, "isLoopback")
    assertEquals(isLocalAddrUrl(url), v.isLocalAddr, "isLocalAddr")
    assertEquals(isInsecureUrl(url), v.isInsecure, "isInsecure")
  })
}

interface RouteReadVector {
  readonly name: string
  readonly context: ReadContext
  readonly expected: {
    readonly branch: "search" | "dmInbox" | "general"
    readonly relays: ReadonlyArray<string> | null
  }
}

for (const v of loadCorpus<RouteReadVector>("route-read.json")) {
  Deno.test(`corpus: routeRead — ${v.name}`, () => {
    const route = routeRead(v.context)
    assertEquals(route.branch, v.expected.branch)
    const actualRelays = route.relays === null ? null : [...route.relays]
    const expectedRelays = v.expected.relays === null ? null : [...v.expected.relays]
    assertEquals(actualRelays, expectedRelays)
  })
}

interface ZapRequestVector {
  readonly name: string
  readonly context: ZapRequestContext
  readonly expected: ReadonlyArray<string>
}

for (const v of loadCorpus<ZapRequestVector>("select-zap-request-relays.json")) {
  Deno.test(`corpus: selectZapRequestRelays — ${v.name}`, () => {
    assertEquals([...selectZapRequestRelays(v.context)], [...v.expected])
  })
}

interface AuthorInboxVector {
  readonly name: string
  readonly context: AuthorRelaysContext
  readonly expected: ReadonlyArray<string>
}

for (const v of loadCorpus<AuthorInboxVector>("select-author-inbox-relays.json")) {
  Deno.test(`corpus: selectAuthorInboxRelays — ${v.name}`, () => {
    assertEquals([...selectAuthorInboxRelays(v.context)], [...v.expected])
  })
}

interface RouteAuthorReadsVector {
  readonly name: string
  readonly context: AuthorReadRouteContext
  readonly expected: ReadonlyArray<{
    readonly relays: ReadonlyArray<string>
    readonly authorChunks: ReadonlyArray<ReadonlyArray<string>>
  }>
}

for (const v of loadCorpus<RouteAuthorReadsVector>("route-author-reads.json")) {
  Deno.test(`corpus: routeAuthorReads — ${v.name}`, () => {
    const actual = routeAuthorReads(v.context)
    const normalised = actual.map((p) => ({
      relays: [...p.relays],
      authorChunks: p.authorChunks.map((chunk) => [...chunk]),
    }))
    const expected = v.expected.map((p) => ({
      relays: [...p.relays],
      authorChunks: p.authorChunks.map((chunk) => [...chunk]),
    }))
    assertEquals(normalised, expected)
  })
}

interface SelectHintVector {
  readonly name: string
  readonly context: RelayHintContext
  readonly expected: string | null
}

for (const v of loadCorpus<SelectHintVector>("select-relay-hint.json")) {
  Deno.test(`corpus: selectRelayHint — ${v.name}`, () => {
    assertEquals(selectRelayHint(v.context), v.expected)
  })
}

interface MissingVector {
  readonly name: string
  readonly event: Event
  readonly relayListEvents: ReadonlyArray<Event>
  readonly expected: ReadonlyArray<string>
}

for (const v of loadCorpus<MissingVector>("missing-relay-list-pubkeys.json")) {
  Deno.test(`corpus: missingRelayListPubkeys — ${v.name}`, () => {
    const actual = missingRelayListPubkeys(v.event, v.relayListEvents)
    assertEquals([...actual], [...v.expected])
  })
}

interface CreateEventVector {
  readonly name: string
  readonly input: unknown
  readonly valid: boolean
}

for (const v of loadCorpus<CreateEventVector>("create-event.json")) {
  Deno.test(`corpus: createEvent — ${v.name}`, () => {
    assertEquals(createEvent(v.input) !== null, v.valid)
  })
}

interface CreateFilterVector {
  readonly name: string
  readonly input: unknown
  readonly valid: boolean
}

for (const v of loadCorpus<CreateFilterVector>("create-filter.json")) {
  Deno.test(`corpus: createFilter — ${v.name}`, () => {
    assertEquals(createFilter(v.input) !== null, v.valid)
  })
}
