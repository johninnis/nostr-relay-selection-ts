import type { AuthorRelaysContext, Event, RelayUrl } from "./types.ts"
import { KIND_DM_RELAY_LIST, KIND_RELAY_LIST } from "./kinds.ts"
import { buildRelaySet, subtractRelays } from "./build-relay-set.ts"
import { extractDmRelayUrls, extractInboxRelayUrls, extractOutboxRelayUrls } from "./relay-list.ts"
import { newestEventByPubkeyAndKind } from "./event-utils.ts"

const select = (
  context: AuthorRelaysContext,
  kind: number,
  extract: (tags: ReadonlyArray<ReadonlyArray<string>>) => ReadonlyArray<RelayUrl>,
): ReadonlyArray<RelayUrl> => {
  const list: Event | null = newestEventByPubkeyAndKind(context.relayListEvents, context.authorPubkey, kind)
  if (!list) return []
  return subtractRelays(buildRelaySet(extract(list.tags)), context.blockedRelays)
}

/** Pick inbox relays for one author from their newest kind 10002 event (`read` / `both` markers). */
export const selectAuthorInboxRelays = (context: AuthorRelaysContext): ReadonlyArray<RelayUrl> =>
  select(context, KIND_RELAY_LIST, extractInboxRelayUrls)

/** Pick outbox relays for one author from their newest kind 10002 event (`write` / `both` markers). */
export const selectAuthorOutboxRelays = (context: AuthorRelaysContext): ReadonlyArray<RelayUrl> =>
  select(context, KIND_RELAY_LIST, extractOutboxRelayUrls)

/** Pick DM relays for one author from their newest kind 10050 event (`relay` tags). */
export const selectAuthorDmRelays = (context: AuthorRelaysContext): ReadonlyArray<RelayUrl> =>
  select(context, KIND_DM_RELAY_LIST, extractDmRelayUrls)
