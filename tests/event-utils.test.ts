import { assert, assertEquals } from "@std/assert"
import { createPublicKey, type Event, newestEventByPubkeyAndKind, routeAuthorReads } from "../mod.ts"

const pubkeyA = createPublicKey("a".repeat(64))
const pubkeyB = createPublicKey("b".repeat(64))
const pubkeyC = createPublicKey("c".repeat(64))
assert(pubkeyA && pubkeyB && pubkeyC)

const relayList = (pubkey: typeof pubkeyA, createdAt: number, urls: ReadonlyArray<string>): Event => ({
  kind: 10002,
  pubkey,
  created_at: createdAt,
  tags: urls.map((url) => ["r", url]),
})

Deno.test("newestEventByPubkeyAndKind - returns the newest event per (pubkey, kind)", () => {
  const events = [
    relayList(pubkeyA, 100, ["wss://old.example"]),
    relayList(pubkeyA, 200, ["wss://new.example"]),
    relayList(pubkeyB, 300, ["wss://other.example"]),
  ]
  assertEquals(newestEventByPubkeyAndKind(events, pubkeyA, 10002)?.created_at, 200)
  assertEquals(newestEventByPubkeyAndKind(events, pubkeyB, 10002)?.created_at, 300)
})

Deno.test("newestEventByPubkeyAndKind - keeps the first-seen event on a created_at tie", () => {
  const first = relayList(pubkeyA, 100, ["wss://first.example"])
  const second = relayList(pubkeyA, 100, ["wss://second.example"])
  assertEquals(newestEventByPubkeyAndKind([first, second], pubkeyA, 10002), first)
})

Deno.test("newestEventByPubkeyAndKind - returns null when no event matches", () => {
  const events = [relayList(pubkeyA, 100, ["wss://a.example"])]
  assertEquals(newestEventByPubkeyAndKind(events, pubkeyB, 10002), null)
  assertEquals(newestEventByPubkeyAndKind(events, pubkeyA, 10050), null)
})

Deno.test("newestEventByPubkeyAndKind - repeated lookups over the same array stay consistent", () => {
  const events = [relayList(pubkeyA, 100, ["wss://a.example"]), relayList(pubkeyB, 200, ["wss://b.example"])]
  const firstLookup = newestEventByPubkeyAndKind(events, pubkeyA, 10002)
  assertEquals(newestEventByPubkeyAndKind(events, pubkeyA, 10002), firstLookup)
  assertEquals(newestEventByPubkeyAndKind(events, pubkeyB, 10002)?.created_at, 200)
})

Deno.test("routeAuthorReads - redundancy 1 covers each author exactly once via the shared relay", () => {
  const shared = "wss://shared.example"
  const routes = routeAuthorReads({
    authorPubkeys: [pubkeyA, pubkeyB, pubkeyC],
    relayListEvents: [
      relayList(pubkeyA, 100, [shared, "wss://a-only.example"]),
      relayList(pubkeyB, 100, [shared, "wss://b-only.example"]),
      relayList(pubkeyC, 100, [shared]),
    ],
    redundancy: 1,
    fallbackRelays: [],
  })
  assertEquals(routes.length, 1)
  assertEquals([...routes[0]?.relays ?? []], [shared])
  assertEquals(new Set(routes[0]?.authorChunks.flat()), new Set([pubkeyA, pubkeyB, pubkeyC]))
})

Deno.test("routeAuthorReads - redundancy 2 still covers every author the required number of times", () => {
  const shared = "wss://shared.example"
  const routes = routeAuthorReads({
    authorPubkeys: [pubkeyA, pubkeyB],
    relayListEvents: [
      relayList(pubkeyA, 100, [shared, "wss://a-only.example"]),
      relayList(pubkeyB, 100, [shared, "wss://b-only.example"]),
    ],
    redundancy: 2,
    fallbackRelays: [],
  })
  const coverage = new Map<string, number>()
  for (const route of routes) {
    for (const pk of route.authorChunks.flat()) coverage.set(pk, (coverage.get(pk) ?? 0) + 1)
  }
  assertEquals(coverage.get(pubkeyA), 2)
  assertEquals(coverage.get(pubkeyB), 2)
})
