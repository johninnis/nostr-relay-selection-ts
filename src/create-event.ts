import type { Event } from "./types.ts"
import { createEventId, createPublicKey } from "./create-public-key.ts"
import { isRecord } from "./is-record.ts"

const isTag = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((item) => typeof item === "string")

const isTagList = (value: unknown): value is ReadonlyArray<ReadonlyArray<string>> =>
  Array.isArray(value) && value.every(isTag)

/**
 * Validate and construct a typed `Event` from JSON-shaped input. Checks `id`,
 * `kind`, `pubkey`, `created_at` and `tags`; returns `null` on malformed input.
 * Use at the wire-format boundary when the input is untrusted JSON.
 */
export const createEvent = (raw: unknown): Event | null => {
  if (!isRecord(raw)) return null
  const { id, kind, pubkey, created_at, tags } = raw
  if (typeof kind !== "number" || !Number.isInteger(kind)) return null
  if (typeof created_at !== "number" || !Number.isInteger(created_at)) return null
  if (!isTagList(tags)) return null
  const validatedId = typeof id === "string" ? createEventId(id) : null
  const validatedPubkey = typeof pubkey === "string" ? createPublicKey(pubkey) : null
  if (validatedId === null || validatedPubkey === null) return null
  return { id: validatedId, kind, pubkey: validatedPubkey, created_at, tags }
}
