import type { Event, PublicKey } from "./types.ts"
import { INBOX_FANOUT_KINDS, KIND_RELAY_LIST } from "./kinds.ts"
import { createPublicKey } from "./create-public-key.ts"

/**
 * For inbox-fanout events, list `p`-tagged pubkeys whose kind 10002 relay list
 * is not yet present in `relayListEvents`. Returns `[]` for kinds outside
 * `INBOX_FANOUT_KINDS`. Useful for triggering cache fills before a publish.
 */
export const missingRelayListPubkeys = (
  event: Event,
  relayListEvents: ReadonlyArray<Event>,
): ReadonlyArray<PublicKey> => {
  if (!INBOX_FANOUT_KINDS.has(event.kind)) return []

  const ptagged = new Set<PublicKey>()
  for (const tag of event.tags) {
    if (tag[0] !== "p" || typeof tag[1] !== "string") continue
    const pubkey = createPublicKey(tag[1])
    if (pubkey === null) continue
    ptagged.add(pubkey)
  }

  const withRelayList = new Set<PublicKey>()
  for (const e of relayListEvents) {
    if (e.kind !== KIND_RELAY_LIST) continue
    if (ptagged.has(e.pubkey)) withRelayList.add(e.pubkey)
  }

  return [...ptagged].filter((pk) => !withRelayList.has(pk))
}
