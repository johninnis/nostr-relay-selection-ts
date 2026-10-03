import type { RelaySet, RelayUrl } from "./types.ts"
import { normaliseRelayUrl } from "./normalise-url.ts"

/**
 * Union already-normalised relay URLs from any number of sources into one
 * `RelaySet`, keeping first-seen order.
 */
export const unionRelays = (...sources: ReadonlyArray<ReadonlyArray<RelayUrl>>): RelaySet => [
  ...new Set(sources.flat()),
]

/**
 * Parse raw relay URL strings from any number of sources into one `RelaySet`:
 * each is normalised with `normaliseRelayUrl`, malformed entries are dropped and
 * duplicates collapse to their first occurrence.
 */
export const buildRelaySet = (...sources: ReadonlyArray<ReadonlyArray<string>>): RelaySet =>
  unionRelays(sources.flat().map(normaliseRelayUrl).filter((url) => url !== null))

/** The relays of `relays` that are not in `blocked`, deduplicated, in first-seen order. */
export const subtractRelays = (relays: ReadonlyArray<RelayUrl>, blocked: ReadonlyArray<RelayUrl>): RelaySet => {
  const blockedSet = new Set(blocked)
  return unionRelays(relays).filter((url) => !blockedSet.has(url))
}
