import type { Event, PublicKey } from "./types.ts"

const newestIndexes = new WeakMap<ReadonlyArray<Event>, Map<string, Event>>()

const newestIndexFor = (events: ReadonlyArray<Event>): Map<string, Event> => {
  let index = newestIndexes.get(events)
  if (index) return index
  index = new Map()
  for (const e of events) {
    const key = `${e.pubkey}:${e.kind}`
    const current = index.get(key)
    if (!current || e.created_at > current.created_at) index.set(key, e)
  }
  newestIndexes.set(events, index)
  return index
}

/**
 * Find the newest event for a given `(pubkey, kind)` tuple in a heterogeneous
 * event array. Used internally by every routing service and exposed for callers
 * building their own cache layers. Returns `null` if no event matches.
 *
 * The array is indexed once per distinct array reference (weakly cached), so
 * repeated lookups over the same array cost one map probe each. The array is
 * treated as an immutable snapshot — mutate it and results go stale; pass a
 * fresh array instead.
 */
export const newestEventByPubkeyAndKind = (
  events: ReadonlyArray<Event>,
  pubkey: PublicKey,
  kind: number,
): Event | null => newestIndexFor(events).get(`${pubkey}:${kind}`) ?? null
