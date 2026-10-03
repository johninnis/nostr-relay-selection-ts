import type { Filter, PublicKey } from "./types.ts"
import { createPublicKey } from "./create-public-key.ts"
import { isRecord } from "./is-record.ts"

const MISSING = Symbol("missing")

const parseKinds = (value: unknown): ReadonlyArray<number> | null =>
  Array.isArray(value) && value.every((kind) => typeof kind === "number" && Number.isInteger(kind)) ? value : null

const parsePubkeys = (value: unknown): ReadonlyArray<PublicKey> | null => {
  if (!Array.isArray(value)) return null
  const pubkeys = value.map((hex) => typeof hex === "string" ? createPublicKey(hex) : null)
  return pubkeys.every((pubkey): pubkey is PublicKey => pubkey !== null) ? pubkeys : null
}

const parseSearch = (value: unknown): string | null => typeof value === "string" ? value : null

/**
 * Validate and construct a typed `Filter` from JSON-shaped input. Validates
 * `kinds`, `#p` (each entry must be a valid pubkey) and `search`; returns
 * `null` on malformed input. Other filter fields are dropped, since routing
 * never reads them. Use at the wire-format boundary when the input is
 * untrusted JSON.
 */
export const createFilter = (raw: unknown): Filter | null => {
  if (!isRecord(raw)) return null
  const kinds = "kinds" in raw ? parseKinds(raw.kinds) : MISSING
  const pTags = "#p" in raw ? parsePubkeys(raw["#p"]) : MISSING
  const search = "search" in raw ? parseSearch(raw.search) : MISSING
  if (kinds === null || pTags === null || search === null) return null
  return {
    ...(kinds === MISSING ? {} : { kinds }),
    ...(pTags === MISSING ? {} : { "#p": pTags }),
    ...(search === MISSING ? {} : { search }),
  }
}
