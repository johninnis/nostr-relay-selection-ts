import type { Event, PublicKey, RelayDirectory, RelayRole, RelaySet, RelayUrl } from "./types.ts"
import { extractRelays, relayListKindOf } from "./relay-role.ts"
import { subtractRelays, unionRelays } from "./relay-set.ts"

const keyOf = (pubkey: PublicKey, kind: number): string => `${pubkey}:${kind}`

const supersedes = (candidate: Event, current: Event | undefined): boolean =>
  current === undefined ||
  candidate.created_at > current.created_at ||
  (candidate.created_at === current.created_at && candidate.id < current.id)

const indexNewest = (events: ReadonlyArray<Event>): ReadonlyMap<string, Event> =>
  events.reduce((index, event) => {
    const key = keyOf(event.pubkey, event.kind)
    return supersedes(event, index.get(key)) ? index.set(key, event) : index
  }, new Map<string, Event>())

/**
 * Index every author's newest relay list per kind, once, together with the
 * caller's blocklist. The newest list is the one with the greatest
 * `created_at`; on a tie the lowest `id` wins (NIP-01), so the answer does not
 * depend on the order of `relayListEvents`. The directory is a snapshot:
 * mutating the input array afterwards does not change it.
 *
 * Every relay set the directory returns has `blockedRelays` subtracted, so a
 * blocked relay is never chosen by any routing function.
 */
export const createRelayDirectory = (
  relayListEvents: ReadonlyArray<Event>,
  blockedRelays: ReadonlyArray<RelayUrl> = [],
): RelayDirectory => {
  const newest = indexNewest(relayListEvents)
  const blocked = unionRelays(blockedRelays)
  const permitted = (...sources: ReadonlyArray<ReadonlyArray<RelayUrl>>): RelaySet =>
    subtractRelays(sources.flat(), blocked)
  const relaysOf = (pubkey: PublicKey, role: RelayRole): RelaySet => {
    const list = newest.get(keyOf(pubkey, relayListKindOf(role)))
    return list === undefined ? [] : permitted(extractRelays(list.tags, role))
  }
  return Object.freeze({ blocked, relaysOf, permitted })
}
