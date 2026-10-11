import type { Event, Tag } from "./types.ts"
import { createEventId, createPublicKey } from "./create-public-key.ts"
import { isRecord } from "./is-record.ts"

const MAX_KIND = 65535

const isTag = (value: unknown): value is Tag =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string")

const isTagList = (value: unknown): value is ReadonlyArray<Tag> => Array.isArray(value) && value.every(isTag)

/**
 * Validate and construct a typed `Event` from JSON-shaped input. Checks `id`,
 * `kind` (an integer from 0 to 65535), `pubkey`, `created_at` (a non-negative
 * integer no larger than `Number.MAX_SAFE_INTEGER`) and `tags` (each one or more
 * strings); returns `null` on malformed input. Use at the wire-format boundary
 * when the input is untrusted JSON.
 */
export const createEvent = (raw: unknown): Event | null => {
  if (!isRecord(raw)) return null
  const { id, kind, pubkey, created_at, tags } = raw
  if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 0 || kind > MAX_KIND) return null
  if (typeof created_at !== "number" || !Number.isSafeInteger(created_at) || created_at < 0) return null
  if (!isTagList(tags)) return null
  const validatedId = typeof id === "string" ? createEventId(id) : null
  const validatedPubkey = typeof pubkey === "string" ? createPublicKey(pubkey) : null
  if (validatedId === null || validatedPubkey === null) return null
  return { id: validatedId, kind, pubkey: validatedPubkey, created_at, tags }
}
