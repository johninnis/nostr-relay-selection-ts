import { assert, assertEquals, assertThrows } from "@std/assert"
import {
  createEventId,
  createPublicKey,
  createRelayDirectory,
  type Event,
  findFilterPattern,
  isDraftKind,
  isGiftWrapKind,
  isIndexedKind,
  isPubkeyDataKind,
  KIND_AUTHORED_PODCASTS_LIST,
  KIND_BLOCKED_RELAYS_LIST,
  KIND_DM_RELAY_LIST,
  KIND_DRAFT_EVENT,
  KIND_EPHEMERAL_GIFT_WRAP,
  KIND_FAVOURITE_PODCASTS_LIST,
  KIND_FOLLOW_LIST,
  KIND_FOLLOW_SET,
  KIND_GIFT_WRAP,
  KIND_GIT_AUTHORS_LIST,
  KIND_GOOD_WIKI_AUTHORS_LIST,
  KIND_KIND_MUTE_SET,
  KIND_LONGFORM_CONTENT_DRAFT,
  KIND_MEDIA_FOLLOWS_LIST,
  KIND_MEDIA_STARTER_PACK,
  KIND_METADATA,
  KIND_MUTE_LIST,
  KIND_RELAY_LIST,
  KIND_REPORTING,
  KIND_SEARCH_RELAYS_LIST,
  KIND_STARTER_PACK,
  NO_DM_RELAYS,
  normaliseRelayUrl,
  type PublicKey,
  relayListKindOf,
  type RelayUrl,
  routeAuthorReads,
  routePublish,
  subtractRelays,
  unionRelays,
} from "../mod.ts"

const requirePublicKey = (hex: string): PublicKey => {
  const pubkey = createPublicKey(hex)
  if (pubkey === null) throw new Error(`Invalid pubkey ${hex}`)
  return pubkey
}

const requireRelayUrl = (raw: string): RelayUrl => {
  const url = normaliseRelayUrl(raw)
  if (url === null) throw new Error(`Invalid relay URL ${raw}`)
  return url
}

const ALICE = requirePublicKey("a".repeat(64))
const TEXT_NOTE = 1
const LONG_FORM_ARTICLE = 30023
const RELAY_A = requireRelayUrl("wss://a.example.com")
const RELAY_B = requireRelayUrl("wss://b.example.com")

const relayList = (urls: ReadonlyArray<string>): Event => {
  const id = createEventId("0".repeat(64))
  if (id === null) throw new Error("Invalid event id")
  return { id, kind: KIND_RELAY_LIST, pubkey: ALICE, created_at: 1, tags: urls.map((url) => ["r", url]) }
}

Deno.test("createPublicKey accepts 64 lowercase hex characters", () => {
  assertEquals(createPublicKey("a".repeat(64)), "a".repeat(64))
})

Deno.test("createPublicKey rejects uppercase, short and non-hex input", () => {
  assertEquals(["A".repeat(64), "a".repeat(63), "z".repeat(64)].map(createPublicKey), [null, null, null])
})

Deno.test("createEventId accepts 64 lowercase hex characters", () => {
  assertEquals(createEventId("f".repeat(64)), "f".repeat(64))
})

Deno.test("createEventId rejects uppercase, short and non-hex input", () => {
  assertEquals(["F".repeat(64), "f".repeat(63), "g".repeat(64)].map(createEventId), [null, null, null])
})

Deno.test("isDraftKind is true for a NIP-37 draft and false for a short note", () => {
  assertEquals([isDraftKind(KIND_DRAFT_EVENT), isDraftKind(TEXT_NOTE)], [true, false])
})

Deno.test("isGiftWrapKind is true for both NIP-59 gift wraps and false for a short note", () => {
  assertEquals([KIND_GIFT_WRAP, KIND_EPHEMERAL_GIFT_WRAP, TEXT_NOTE].map(isGiftWrapKind), [true, true, false])
})

Deno.test("isIndexedKind covers profile, follow list and both relay lists, not short notes", () => {
  assertEquals(
    [KIND_METADATA, KIND_FOLLOW_LIST, KIND_RELAY_LIST, KIND_DM_RELAY_LIST, TEXT_NOTE].map(isIndexedKind),
    [true, true, true, true, false],
  )
})

Deno.test("isPubkeyDataKind covers the follow list, every NIP-51 list and set of people, and the report", () => {
  const pubkeyDataKinds = [
    KIND_FOLLOW_LIST,
    KIND_REPORTING,
    KIND_MUTE_LIST,
    KIND_GIT_AUTHORS_LIST,
    KIND_MEDIA_FOLLOWS_LIST,
    KIND_FAVOURITE_PODCASTS_LIST,
    KIND_AUTHORED_PODCASTS_LIST,
    KIND_GOOD_WIKI_AUTHORS_LIST,
    KIND_FOLLOW_SET,
    KIND_KIND_MUTE_SET,
    KIND_STARTER_PACK,
    KIND_MEDIA_STARTER_PACK,
  ]
  assertEquals(pubkeyDataKinds.map(isPubkeyDataKind), pubkeyDataKinds.map(() => true))
})

Deno.test("isPubkeyDataKind is false for kinds whose p tags are mentions", () => {
  assertEquals([KIND_METADATA, TEXT_NOTE, LONG_FORM_ARTICLE, KIND_LONGFORM_CONTENT_DRAFT].map(isPubkeyDataKind), [
    false,
    false,
    false,
    false,
  ])
})

Deno.test("relayListKindOf names the kind each role is read from", () => {
  assertEquals(
    (["inbox", "outbox", "dm", "search", "blocked"] as const).map(relayListKindOf),
    [KIND_RELAY_LIST, KIND_RELAY_LIST, KIND_DM_RELAY_LIST, KIND_SEARCH_RELAYS_LIST, KIND_BLOCKED_RELAYS_LIST],
  )
})

Deno.test("unionRelays keeps the first occurrence of each URL in order", () => {
  assertEquals(unionRelays([RELAY_B, RELAY_A], [RELAY_A, RELAY_B]), [RELAY_B, RELAY_A])
})

Deno.test("subtractRelays removes blocked URLs and duplicates, preserving order", () => {
  assertEquals(subtractRelays([RELAY_A, RELAY_B, RELAY_A], [RELAY_B]), [RELAY_A])
})

Deno.test("a relay directory is a snapshot: mutating the input array afterwards changes nothing", () => {
  const events: Array<Event> = [relayList(["wss://a.example.com"])]
  const directory = createRelayDirectory(events)
  events.push({ ...relayList(["wss://b.example.com"]), created_at: 2 })
  assertEquals(directory.relaysOf(ALICE, "inbox"), [RELAY_A])
})

Deno.test("a relay directory is frozen", () => {
  assert(Object.isFrozen(createRelayDirectory([])))
})

Deno.test("a relay directory exposes its blocklist deduplicated", () => {
  assertEquals(createRelayDirectory([], [RELAY_A, RELAY_A]).blocked, [RELAY_A])
})

Deno.test("findFilterPattern carries the shared gift-wrap recipient on the dmInbox pattern", () => {
  assertEquals(findFilterPattern([{ kinds: [KIND_GIFT_WRAP], "#p": [ALICE] }]), {
    branch: "dmInbox",
    recipient: ALICE,
  })
})

Deno.test("routePublish refuses a gift wrap with no DM relays by returning NO_DM_RELAYS", () => {
  const event = { ...relayList([]), kind: KIND_GIFT_WRAP, tags: [["p", ALICE]] }
  assertEquals(routePublish(event, createRelayDirectory([])), NO_DM_RELAYS)
})

Deno.test("routePublish rejects a fractional perRecipientCap", () => {
  const event = { ...relayList([]), kind: TEXT_NOTE }
  assertThrows(() => routePublish(event, createRelayDirectory([]), { perRecipientCap: 1.5 }), RangeError)
})

Deno.test("routePublish names Infinity among the accepted perRecipientCap values when it rejects one", () => {
  const event = { ...relayList([]), kind: TEXT_NOTE }
  assertThrows(
    () => routePublish(event, createRelayDirectory([]), { perRecipientCap: 0 }),
    RangeError,
    "perRecipientCap must be a positive integer or Infinity, got 0",
  )
})

Deno.test("routeAuthorReads accepts Infinity as redundancy and reads every author from every relay", () => {
  const directory = createRelayDirectory([relayList(["wss://a.example.com", "wss://b.example.com"])])
  const routes = routeAuthorReads([ALICE], directory, { redundancy: Number.POSITIVE_INFINITY })
  assertEquals(routes.map((route) => route.relays), [[RELAY_A], [RELAY_B]])
})

Deno.test("routeAuthorReads rejects a fractional, NaN or negative-infinite redundancy", () => {
  const directory = createRelayDirectory([])
  for (const redundancy of [2.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
    assertThrows(() => routeAuthorReads([ALICE], directory, { redundancy }), RangeError)
  }
})
