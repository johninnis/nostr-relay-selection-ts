import type { PublicKey, RelayUrl, ZapRequestContext } from "./types.ts"
import { KIND_RELAY_LIST } from "./kinds.ts"
import { buildRelaySet, subtractRelays } from "./build-relay-set.ts"
import { extractInboxRelayUrls } from "./relay-list.ts"
import { newestEventByPubkeyAndKind } from "./event-utils.ts"

const inboxOf = (
  relayListEvents: ZapRequestContext["relayListEvents"],
  pubkey: PublicKey,
): ReadonlyArray<RelayUrl> => {
  const list = newestEventByPubkeyAndKind(relayListEvents, pubkey, KIND_RELAY_LIST)
  return list ? extractInboxRelayUrls(list.tags) : []
}

/**
 * Merge zapper and recipient inbox relays for a zap request (NIP-57). Both
 * sides' newest kind 10002 inbox entries are unioned in input order;
 * `blockedRelays` is subtracted.
 */
export const selectZapRequestRelays = (context: ZapRequestContext): ReadonlyArray<RelayUrl> =>
  subtractRelays(
    buildRelaySet(
      inboxOf(context.relayListEvents, context.zapperPubkey),
      inboxOf(context.relayListEvents, context.recipientPubkey),
    ),
    context.blockedRelays,
  )
