import type { RelayHintContext, RelayUrl } from "./types.ts"
import { KIND_RELAY_LIST } from "./kinds.ts"
import { subtractRelays } from "./build-relay-set.ts"
import { extractInboxRelayUrls, extractOutboxRelayUrls } from "./relay-list.ts"
import { newestEventByPubkeyAndKind } from "./event-utils.ts"

/**
 * Pick a single relay URL hint for an `e` / `p` / `q` tag. Prefers the
 * intersection of the user's outbox with the target's inbox, falls back to
 * either side's first relay, returns `null` if neither side has a list.
 */
export const selectRelayHint = (context: RelayHintContext): RelayUrl | null => {
  const targetList = newestEventByPubkeyAndKind(context.relayListEvents, context.targetPubkey, KIND_RELAY_LIST)
  const userList = newestEventByPubkeyAndKind(context.relayListEvents, context.userPubkey, KIND_RELAY_LIST)
  const targetInbox = subtractRelays(
    targetList ? extractInboxRelayUrls(targetList.tags) : [],
    context.blockedRelays,
  )
  const userOutbox = subtractRelays(
    userList ? extractOutboxRelayUrls(userList.tags) : [],
    context.blockedRelays,
  )

  const targetInboxSet = new Set(targetInbox)
  for (const url of userOutbox) {
    if (targetInboxSet.has(url)) return url
  }

  if (targetInbox.length > 0) return targetInbox[0] ?? null
  if (userOutbox.length > 0) return userOutbox[0] ?? null
  return null
}
