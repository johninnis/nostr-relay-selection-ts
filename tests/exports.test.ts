import { assertEquals } from "@std/assert"
import {
  createPublicKey,
  DRAFT_KINDS,
  type Event,
  INBOX_FANOUT_KINDS,
  INDEXED_KINDS,
  KIND_DM_RELAY_LIST,
  KIND_DRAFT_EVENT,
  KIND_FOLLOW_LIST,
  KIND_GIFT_WRAP,
  KIND_PROFILE_METADATA,
  KIND_RELAY_LIST,
  KIND_SHORT_NOTE,
  newestEventByPubkeyAndKind,
  normaliseRelayUrl,
  type PublicKey,
  type RelayUrl,
  sharedGiftWrapRecipient,
  subtractRelays,
} from "../mod.ts"

const ALICE = "a".repeat(64)
const BOB = "b".repeat(64)

const requirePublicKey = (hex: string): PublicKey => {
  const pk = createPublicKey(hex)
  if (pk === null) throw new Error(`Invalid pubkey ${hex}`)
  return pk
}

const requireRelayUrl = (raw: string): RelayUrl => {
  const url = normaliseRelayUrl(raw)
  if (url === null) throw new Error(`Invalid relay URL ${raw}`)
  return url
}

Deno.test("createPublicKey returns a branded PublicKey for valid lowercase 64-hex input", () => {
  const pk = createPublicKey(ALICE)
  assertEquals(pk, ALICE)
})

Deno.test("createPublicKey returns null for uppercase hex", () => {
  assertEquals(createPublicKey("A".repeat(64)), null)
})

Deno.test("createPublicKey returns null for wrong length", () => {
  assertEquals(createPublicKey("a".repeat(63)), null)
})

Deno.test("createPublicKey returns null for non-hex characters", () => {
  assertEquals(createPublicKey("z".repeat(64)), null)
})

Deno.test("INBOX_FANOUT_KINDS contains KIND_SHORT_NOTE and excludes KIND_PROFILE_METADATA", () => {
  assertEquals(INBOX_FANOUT_KINDS.has(KIND_SHORT_NOTE), true)
  assertEquals(INBOX_FANOUT_KINDS.has(KIND_PROFILE_METADATA), false)
})

Deno.test("DRAFT_KINDS contains KIND_DRAFT_EVENT and excludes KIND_SHORT_NOTE", () => {
  assertEquals(DRAFT_KINDS.has(KIND_DRAFT_EVENT), true)
  assertEquals(DRAFT_KINDS.has(KIND_SHORT_NOTE), false)
})

Deno.test("INDEXED_KINDS contains KIND_PROFILE_METADATA, KIND_FOLLOW_LIST, KIND_RELAY_LIST and KIND_DM_RELAY_LIST", () => {
  assertEquals(INDEXED_KINDS.has(KIND_PROFILE_METADATA), true)
  assertEquals(INDEXED_KINDS.has(KIND_FOLLOW_LIST), true)
  assertEquals(INDEXED_KINDS.has(KIND_RELAY_LIST), true)
  assertEquals(INDEXED_KINDS.has(KIND_DM_RELAY_LIST), true)
  assertEquals(INDEXED_KINDS.has(KIND_SHORT_NOTE), false)
})

Deno.test("newestEventByPubkeyAndKind returns the latest event matching pubkey and kind", () => {
  const alice = requirePublicKey(ALICE)
  const bob = requirePublicKey(BOB)
  const older: Event = { kind: KIND_RELAY_LIST, pubkey: alice, tags: [], created_at: 100 }
  const newer: Event = { kind: KIND_RELAY_LIST, pubkey: alice, tags: [], created_at: 200 }
  const wrongPubkey: Event = { kind: KIND_RELAY_LIST, pubkey: bob, tags: [], created_at: 300 }
  const wrongKind: Event = { kind: KIND_SHORT_NOTE, pubkey: alice, tags: [], created_at: 400 }

  const result = newestEventByPubkeyAndKind([older, newer, wrongPubkey, wrongKind], alice, KIND_RELAY_LIST)
  assertEquals(result, newer)
})

Deno.test("newestEventByPubkeyAndKind returns null when no event matches", () => {
  const alice = requirePublicKey(ALICE)
  assertEquals(newestEventByPubkeyAndKind([], alice, KIND_RELAY_LIST), null)
})

Deno.test("sharedGiftWrapRecipient returns the recipient when every filter targets the same pubkey", () => {
  const alice = requirePublicKey(ALICE)
  const result = sharedGiftWrapRecipient([
    { kinds: [KIND_GIFT_WRAP], "#p": [alice] },
    { kinds: [KIND_GIFT_WRAP], "#p": [alice] },
  ])
  assertEquals(result, alice)
})

Deno.test("sharedGiftWrapRecipient returns null when recipients differ", () => {
  const alice = requirePublicKey(ALICE)
  const bob = requirePublicKey(BOB)
  const result = sharedGiftWrapRecipient([
    { kinds: [KIND_GIFT_WRAP], "#p": [alice] },
    { kinds: [KIND_GIFT_WRAP], "#p": [bob] },
  ])
  assertEquals(result, null)
})

Deno.test("sharedGiftWrapRecipient returns null for an empty filter set", () => {
  assertEquals(sharedGiftWrapRecipient([]), null)
})

Deno.test("sharedGiftWrapRecipient returns null when a filter has the wrong kind", () => {
  const alice = requirePublicKey(ALICE)
  assertEquals(
    sharedGiftWrapRecipient([{ kinds: [KIND_SHORT_NOTE], "#p": [alice] }]),
    null,
  )
})

Deno.test("subtractRelays removes blocked URLs while preserving order", () => {
  const a = requireRelayUrl("wss://a.example.com")
  const b = requireRelayUrl("wss://b.example.com")
  const c = requireRelayUrl("wss://c.example.com")
  assertEquals(subtractRelays([a, b, c], [b]), [a, c])
})

Deno.test("subtractRelays returns the input unchanged when blocked is undefined", () => {
  const a = requireRelayUrl("wss://a.example.com")
  assertEquals(subtractRelays([a], undefined), [a])
})

Deno.test("subtractRelays returns the input unchanged when blocked is empty", () => {
  const a = requireRelayUrl("wss://a.example.com")
  assertEquals(subtractRelays([a], []), [a])
})
