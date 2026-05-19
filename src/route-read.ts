import type { PublicKey, ReadBranch, ReadContext, RelayUrl } from "./types.ts"
import { KIND_DM_RELAY_LIST } from "./kinds.ts"
import { buildRelaySet, subtractRelays } from "./build-relay-set.ts"
import { extractDmRelayUrls } from "./relay-list.ts"
import { newestEventByPubkeyAndKind } from "./event-utils.ts"
import { findFilterPattern, sharedGiftWrapRecipient } from "./find-filter-pattern.ts"

/**
 * Result of `routeRead`. `branch` discriminates the policy that applied;
 * `relays` is the target list (which may be `null` for the `"dmInbox"` branch
 * when the recipient has no DM-inbox route).
 */
export interface ReadRoute {
  readonly branch: ReadBranch
  readonly relays: ReadonlyArray<RelayUrl> | null
}

const dmInboxRelays = (context: ReadContext, recipient: PublicKey | null): ReadonlyArray<RelayUrl> | null => {
  if (recipient === null) return null
  const list = newestEventByPubkeyAndKind(context.relayListEvents, recipient, KIND_DM_RELAY_LIST)
  if (!list) return null
  const relays = buildRelaySet(extractDmRelayUrls(list.tags))
  return relays.length === 0 ? null : relays
}

/**
 * Decide which relays to subscribe to for a set of filters. Dispatches on
 * filter shape into one of three branches: `"search"` (any filter has a
 * non-empty `search` field; unions `searchRelays` with `callerRelays`);
 * `"dmInbox"` (every filter is `{kinds: [1059], "#p": [singleRecipient]}` with
 * a shared recipient; targets the recipient's kind 10050 inboxes, or `null`);
 * `"general"` (everything else; unions `userRelayUrls` with `callerRelays`).
 * `blockedRelays` is subtracted from every output uniformly.
 */
export const routeRead = (context: ReadContext): ReadRoute => {
  const branch = findFilterPattern(context.filters)
  if (branch === "dmInbox") {
    const relays = dmInboxRelays(context, sharedGiftWrapRecipient(context.filters))
    if (relays === null) return { branch, relays: null }
    const afterBlock = subtractRelays(relays, context.blockedRelays)
    return { branch, relays: afterBlock.length === 0 ? null : afterBlock }
  }
  const relays = branch === "search"
    ? buildRelaySet(context.searchRelays ?? [], context.callerRelays)
    : buildRelaySet(context.userRelayUrls, context.callerRelays)
  return { branch, relays: subtractRelays(relays, context.blockedRelays) }
}
