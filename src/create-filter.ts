import type { Filter, PublicKey } from "./types.ts"
import { createPublicKey } from "./create-public-key.ts"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Validate and construct a typed `Filter` from JSON-shaped input. Validates
 * `kinds`, `#p` (each entry must be a valid pubkey), and `search`; returns
 * `null` on malformed input. Use at the wire-format boundary when the input is
 * untrusted JSON.
 */
export const createFilter = (raw: unknown): Filter | null => {
  if (!isRecord(raw)) return null

  const result: Record<string, unknown> = {}

  if ("kinds" in raw) {
    const rawKinds = raw.kinds
    if (!Array.isArray(rawKinds)) return null
    const kinds: Array<number> = []
    for (const kind of rawKinds) {
      if (typeof kind !== "number" || !Number.isInteger(kind)) return null
      kinds.push(kind)
    }
    result.kinds = kinds
  }

  if ("#p" in raw) {
    const rawP = raw["#p"]
    if (!Array.isArray(rawP)) return null
    const pTags: Array<PublicKey> = []
    for (const pubkeyHex of rawP) {
      if (typeof pubkeyHex !== "string") return null
      const pubkey = createPublicKey(pubkeyHex)
      if (pubkey === null) return null
      pTags.push(pubkey)
    }
    result["#p"] = pTags
  }

  if ("search" in raw) {
    if (typeof raw.search !== "string") return null
    result.search = raw.search
  }

  return result as Filter
}
