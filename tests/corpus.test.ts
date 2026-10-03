import { assertEquals, assertThrows } from "@std/assert"
import {
  buildRelaySet,
  createEvent,
  createFilter,
  extractRelays,
  findFilterPattern,
  isInsecureUrl,
  isLocalAddrUrl,
  isLoopbackUrl,
  isOnionUrl,
  type NoDmRelaysFailure,
  normaliseRelayUrl,
  type PublishRoute,
  type ReadRoute,
  recipientsWithoutInbox,
  type RelayHintTarget,
  routeAuthorReads,
  routePublish,
  routeRead,
  selectRelayHint,
  selectZapRequestRelays,
} from "../mod.ts"
import {
  directoryOf,
  eventOf,
  filtersOf,
  isInvalidArgument,
  type Json,
  loadVectors,
  objectOf,
  optionalNumberOf,
  pubkeyOf,
  pubkeysOf,
  relayUrlOf,
  relayUrlsOf,
  roleOf,
  stringOf,
  stringsOf,
  tagsOf,
} from "./support/corpus.ts"

const outcomeOf = (result: PublishRoute | ReadRoute | NoDmRelaysFailure): unknown =>
  "failure" in result ? { failure: result.failure } : { branch: result.branch, relays: [...result.relays] }

const hintTargetOf = (v: Json): RelayHintTarget => ({
  pubkey: pubkeyOf(v.targetPubkey),
  seenOn: v.seenOn === undefined ? undefined : relayUrlOf(v.seenOn),
})

const countOrAllOf = (value: unknown): number | undefined =>
  value === "all" ? Number.POSITIVE_INFINITY : optionalNumberOf(value)

for (const v of loadVectors("normalise-url.json")) {
  Deno.test(`corpus: normaliseRelayUrl — ${v.name}`, () => {
    assertEquals(normaliseRelayUrl(v.input === null ? null : stringOf(v.input)), v.expected)
  })
  if (typeof v.expected === "string") {
    const canonical = v.expected
    Deno.test(`corpus: normaliseRelayUrl is idempotent — ${v.name}`, () => {
      assertEquals(normaliseRelayUrl(canonical), canonical)
    })
  }
}

for (const v of loadVectors("build-relay-set.json")) {
  Deno.test(`corpus: buildRelaySet — ${v.name}`, () => {
    assertEquals([...buildRelaySet(...(Array.isArray(v.input) ? v.input : []).map(stringsOf))], v.expected)
  })
}

for (const v of loadVectors("extract-relay-urls.json")) {
  Deno.test(`corpus: extractRelays(${v.role}) — ${v.name}`, () => {
    assertEquals([...extractRelays(tagsOf(v.tags), roleOf(v.role))], v.expected)
  })
}

for (const v of loadVectors("relays-of.json")) {
  Deno.test(`corpus: relaysOf(${v.role}) — ${v.name}`, () => {
    assertEquals([...directoryOf(v.directory).relaysOf(pubkeyOf(v.pubkey), roleOf(v.role))], v.expected)
  })
}

for (const v of loadVectors("route-publish.json")) {
  Deno.test(`corpus: routePublish — ${v.name}`, () => {
    const policy = objectOf(v.policy)
    const route = (): PublishRoute | NoDmRelaysFailure =>
      routePublish(eventOf(v.event), directoryOf(v.directory), {
        privateContentRelays: relayUrlsOf(policy.privateContentRelays),
        indexerRelays: relayUrlsOf(policy.indexerRelays),
        groupRelays: relayUrlsOf(policy.groupRelays),
        perRecipientCap: countOrAllOf(policy.perRecipientCap),
      })
    if (isInvalidArgument(v.expected)) assertThrows(route, RangeError)
    else assertEquals(outcomeOf(route()), v.expected)
  })
}

for (const v of loadVectors("route-read.json")) {
  Deno.test(`corpus: routeRead — ${v.name}`, () => {
    const policy = objectOf(v.policy)
    const route = routeRead(filtersOf(v.filters), directoryOf(v.directory), {
      userPubkey: pubkeyOf(policy.userPubkey),
      callerRelays: relayUrlsOf(policy.callerRelays),
    })
    assertEquals(outcomeOf(route), v.expected)
  })
}

for (const v of loadVectors("route-author-reads.json")) {
  Deno.test(`corpus: routeAuthorReads — ${v.name}`, () => {
    const policy = objectOf(v.policy)
    const routes = (): unknown =>
      routeAuthorReads(pubkeysOf(v.authors), directoryOf(v.directory), {
        fallbackRelays: relayUrlsOf(policy.fallbackRelays),
        maxAuthorsPerFilter: optionalNumberOf(policy.maxAuthorsPerFilter),
        redundancy: countOrAllOf(policy.redundancy),
      }).map((route) => ({ relays: [...route.relays], authorChunks: route.authorChunks.map((chunk) => [...chunk]) }))
    if (isInvalidArgument(v.expected)) assertThrows(routes, RangeError)
    else assertEquals(routes(), v.expected)
  })
}

for (const v of loadVectors("select-relay-hint.json")) {
  Deno.test(`corpus: selectRelayHint — ${v.name}`, () => {
    assertEquals(
      selectRelayHint(pubkeyOf(v.userPubkey), hintTargetOf(v), directoryOf(v.directory)),
      v.expected,
    )
  })
}

for (const v of loadVectors("select-zap-request-relays.json")) {
  Deno.test(`corpus: selectZapRequestRelays — ${v.name}`, () => {
    const relays = selectZapRequestRelays(
      pubkeyOf(v.zapperPubkey),
      pubkeyOf(v.recipientPubkey),
      directoryOf(v.directory),
    )
    assertEquals([...relays], v.expected)
  })
}

for (const v of loadVectors("recipients-without-inbox.json")) {
  Deno.test(`corpus: recipientsWithoutInbox — ${v.name}`, () => {
    assertEquals([...recipientsWithoutInbox(eventOf(v.event), directoryOf(v.directory))], v.expected)
  })
}

for (const v of loadVectors("find-filter-pattern.json")) {
  Deno.test(`corpus: findFilterPattern — ${v.name}`, () => {
    assertEquals(findFilterPattern(filtersOf(v.filters)).branch, v.expected)
  })
}

for (const v of loadVectors("classify-url.json")) {
  Deno.test(`corpus: classify-url — ${v.name}`, () => {
    const url = normaliseRelayUrl(stringOf(v.input))
    if (url === null) throw new Error(`expected ${v.input} to parse`)
    assertEquals(
      [isOnionUrl(url), isLoopbackUrl(url), isLocalAddrUrl(url), isInsecureUrl(url)],
      [v.isOnion, v.isLoopback, v.isLocalAddr, v.isInsecure],
    )
  })
}

for (const v of loadVectors("create-event.json")) {
  Deno.test(`corpus: createEvent — ${v.name}`, () => {
    assertEquals(createEvent(v.input) !== null, v.valid)
  })
}

for (const v of loadVectors("create-filter.json")) {
  Deno.test(`corpus: createFilter — ${v.name}`, () => {
    assertEquals(createFilter(v.input) !== null, v.valid)
  })
}
