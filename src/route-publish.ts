import type { Event, PublicKey, PublishBranch, PublishContext, RelayUrl } from "./types.ts"
import {
  DRAFT_KINDS,
  INBOX_FANOUT_KINDS,
  INDEXED_KINDS,
  KIND_DM_RELAY_LIST,
  KIND_GIFT_WRAP,
  KIND_RELAY_LIST,
} from "./kinds.ts"
import { buildRelaySet, subtractRelays } from "./build-relay-set.ts"
import { extractDmRelayUrls, extractInboxRelayUrls, extractOutboxRelayUrls } from "./relay-list.ts"
import { normaliseRelayUrl } from "./normalise-url.ts"
import { newestEventByPubkeyAndKind } from "./event-utils.ts"
import { createPublicKey } from "./create-public-key.ts"

const DEFAULT_PER_RECIPIENT_CAP = 3

/**
 * Result of `routePublish`. `branch` discriminates the policy that applied;
 * `relays` is the target list (which may be empty, or `null` for the `"dm"`
 * branch when no DM-relay route exists).
 */
export interface PublishRoute {
  readonly branch: PublishBranch
  readonly relays: ReadonlyArray<RelayUrl> | null
}

interface Recipient {
  readonly pubkey: PublicKey
  readonly hint: string | null
}

const uniqueRecipientsInOrder = (event: Event): ReadonlyArray<Recipient> => {
  const result: Array<Recipient> = []
  const seen = new Set<PublicKey>()
  for (const tag of event.tags) {
    if (tag[0] !== "p" || typeof tag[1] !== "string") continue
    const pubkey = createPublicKey(tag[1])
    if (pubkey === null || seen.has(pubkey)) continue
    seen.add(pubkey)
    const hint = typeof tag[2] === "string" && tag[2].length > 0 ? tag[2] : null
    result.push({ pubkey, hint })
  }
  return result
}

const userOutboxOf = (context: PublishContext): ReadonlyArray<RelayUrl> => {
  const list = newestEventByPubkeyAndKind(context.relayListEvents, context.userPubkey, KIND_RELAY_LIST)
  return list ? extractOutboxRelayUrls(list.tags) : []
}

const recipientInboxRelays = (
  recipient: Recipient,
  relayListEvents: ReadonlyArray<Event>,
  cap: number,
): ReadonlyArray<RelayUrl> => {
  const relayList = newestEventByPubkeyAndKind(relayListEvents, recipient.pubkey, KIND_RELAY_LIST)
  if (relayList) {
    const inbox = extractInboxRelayUrls(relayList.tags)
    if (inbox.length > 0) return inbox.slice(0, cap)
  }
  if (recipient.hint) {
    const normalised = normaliseRelayUrl(recipient.hint)
    if (normalised) return [normalised]
  }
  return []
}

const recipientInboxFanout = (
  event: Event,
  relayListEvents: ReadonlyArray<Event>,
  cap: number,
): ReadonlyArray<RelayUrl> => {
  const out: Array<RelayUrl> = []
  for (const recipient of uniqueRecipientsInOrder(event)) {
    for (const url of recipientInboxRelays(recipient, relayListEvents, cap)) out.push(url)
  }
  return out
}

const generalRelays = (event: Event, context: PublishContext): ReadonlyArray<RelayUrl> => {
  const cap = context.perRecipientCap ?? DEFAULT_PER_RECIPIENT_CAP
  const inbox = INBOX_FANOUT_KINDS.has(event.kind) ? recipientInboxFanout(event, context.relayListEvents, cap) : []
  const indexers = INDEXED_KINDS.has(event.kind) ? context.indexerRelays : []
  return buildRelaySet(userOutboxOf(context), inbox, indexers)
}

const dmRelays = (event: Event, context: PublishContext): ReadonlyArray<RelayUrl> | null => {
  const out: Array<RelayUrl> = []
  for (const recipient of uniqueRecipientsInOrder(event)) {
    const dmList = newestEventByPubkeyAndKind(context.relayListEvents, recipient.pubkey, KIND_DM_RELAY_LIST)
    if (!dmList) continue
    for (const url of extractDmRelayUrls(dmList.tags)) out.push(url)
  }
  const relays = buildRelaySet(out)
  return relays.length === 0 ? null : relays
}

const draftRelays = (context: PublishContext): ReadonlyArray<RelayUrl> => {
  if (context.privateContentRelays.length > 0) return buildRelaySet(context.privateContentRelays)
  return buildRelaySet(userOutboxOf(context))
}

// NIP-29 group tag: ["h", "<group-id>", "<relay-hint>?"]. The relay hint is optional, so the group's
// relays come from the hint when present, the caller-supplied `groupRelays` otherwise (or both).
const groupTagOf = (event: Event): ReadonlyArray<string> | undefined =>
  event.tags.find((tag) => tag[0] === "h" && typeof tag[1] === "string" && tag[1].length > 0)

const groupRelaysFor = (groupTag: ReadonlyArray<string>, context: PublishContext): ReadonlyArray<RelayUrl> => {
  const hint = typeof groupTag[2] === "string" ? normaliseRelayUrl(groupTag[2]) : null
  return buildRelaySet(hint ? [hint] : [], context.groupRelays ?? [])
}

/**
 * Decide which relays to publish an event to. Dispatches into one of four branches:
 * `"group"` (NIP-29 — any event carrying an `h` tag whose group relays are known, from the tag's
 * optional relay hint and/or the caller-supplied `groupRelays`; targets those relays only, no outbox
 * fan-out); `"dm"` (kind 1059, NIP-17 gift-wrap; targets recipients' kind 10050 inboxes, or `null`
 * if none); `"draft"` (kinds 30024 / 30403 / 31234; targets `privateContentRelays` or falls back to
 * the user's outbox); `"general"` (everything else; user's outbox plus, for `INBOX_FANOUT_KINDS`,
 * recipient inbox fanout capped per recipient, plus, for `INDEXED_KINDS`, `indexerRelays`). An
 * `h`-tagged event with no resolvable group relay falls through to its kind's normal branch.
 * `blockedRelays` is subtracted from every output uniformly.
 */
export const routePublish = (event: Event, context: PublishContext): PublishRoute => {
  const groupTag = groupTagOf(event)
  if (groupTag) {
    const groupRelays = groupRelaysFor(groupTag, context)
    if (groupRelays.length > 0) return { branch: "group", relays: subtractRelays(groupRelays, context.blockedRelays) }
  }
  const branch: PublishBranch = event.kind === KIND_GIFT_WRAP ? "dm" : DRAFT_KINDS.has(event.kind) ? "draft" : "general"
  if (branch === "dm") {
    const relays = dmRelays(event, context)
    if (relays === null) return { branch, relays: null }
    const afterBlock = subtractRelays(relays, context.blockedRelays)
    return { branch, relays: afterBlock.length === 0 ? null : afterBlock }
  }
  const relays = branch === "draft" ? draftRelays(context) : generalRelays(event, context)
  return { branch, relays: subtractRelays(relays, context.blockedRelays) }
}
