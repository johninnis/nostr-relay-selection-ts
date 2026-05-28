import type { RelayUrl } from "./types.ts"
import { normaliseRelayUrl } from "./normalise-url.ts"

/**
 * Merge any number of relay sources into one deduplicated list, preserving
 * first-seen order. Each URL is run through `normaliseRelayUrl`; malformed
 * entries are dropped.
 */
export const buildRelaySet = (
  ...sources: ReadonlyArray<ReadonlyArray<string>>
): ReadonlyArray<RelayUrl> => {
  const seen = new Set<RelayUrl>()
  const result: Array<RelayUrl> = []
  for (const source of sources) {
    for (const url of source) {
      const normalised = normaliseRelayUrl(url)
      if (!normalised || seen.has(normalised)) continue
      seen.add(normalised)
      result.push(normalised)
    }
  }
  return result
}

/** Remove URLs in `blocked` from a relay set. Order is preserved. */
export const subtractRelays = (
  relays: ReadonlyArray<RelayUrl>,
  blocked: ReadonlyArray<RelayUrl> | undefined,
): ReadonlyArray<RelayUrl> => {
  if (!blocked || blocked.length === 0) return relays
  const blockedSet = new Set<RelayUrl>(blocked)
  if (blockedSet.size === 0) return relays
  return relays.filter((url) => !blockedSet.has(url))
}
