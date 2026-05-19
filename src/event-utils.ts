import type { Event, PublicKey } from "./types.ts"

/**
 * Find the newest event for a given `(pubkey, kind)` tuple in a heterogeneous
 * event array. Used internally by every routing service and exposed for callers
 * building their own cache layers. Returns `null` if no event matches.
 */
export const newestEventByPubkeyAndKind = (
  events: ReadonlyArray<Event>,
  pubkey: PublicKey,
  kind: number,
): Event | null => {
  let newest: Event | null = null
  for (const e of events) {
    if (e.kind !== kind) continue
    if (e.pubkey !== pubkey) continue
    if (!newest || e.created_at > newest.created_at) newest = e
  }
  return newest
}
