import type { Event } from "./types.ts"
import { createPublicKey } from "./create-public-key.ts"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is ReadonlyArray<string> => {
  if (!Array.isArray(value)) return false
  for (const item of value) if (typeof item !== "string") return false
  return true
}

/**
 * Validate and construct a typed `Event` from JSON-shaped input. Checks `kind`,
 * `pubkey`, `created_at`, and `tags` shape; returns `null` on malformed input.
 * Use at the wire-format boundary when the input is untrusted JSON.
 */
export const createEvent = (raw: unknown): Event | null => {
  if (!isRecord(raw)) return null
  const { kind, pubkey, created_at, tags } = raw
  if (typeof kind !== "number" || !Number.isInteger(kind)) return null
  if (typeof created_at !== "number" || !Number.isInteger(created_at)) return null
  if (typeof pubkey !== "string") return null
  const validatedPubkey = createPublicKey(pubkey)
  if (validatedPubkey === null) return null
  if (!Array.isArray(tags)) return null

  const validatedTags: Array<ReadonlyArray<string>> = []
  for (const tag of tags) {
    if (!isStringArray(tag)) return null
    validatedTags.push(tag)
  }

  return {
    kind,
    pubkey: validatedPubkey,
    created_at,
    tags: validatedTags,
  }
}
