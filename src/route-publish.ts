import type {
  Event,
  NoDmRelaysFailure,
  PublishPolicy,
  PublishRoute,
  RelayDirectory,
  RelaySet,
  RelayUrl,
} from "./types.ts"
import { isDraftKind, isGiftWrapKind, isIndexedKind, KIND_PUBLIC_MESSAGE } from "./kinds.ts"
import { type GroupClaim, groupClaimOf } from "./group-claim.ts"
import { unionRelays } from "./relay-set.ts"
import { type Recipient, recipientsOf } from "./recipients.ts"
import { NO_DM_RELAYS } from "./no-dm-relays.ts"
import { requireCountOrAll } from "./counts.ts"

interface PublishSettings {
  readonly privateContentRelays: ReadonlyArray<RelayUrl>
  readonly indexerRelays: ReadonlyArray<RelayUrl>
  readonly groupRelays: ReadonlyArray<RelayUrl>
  readonly perRecipientCap: number
}

const settingsOf = (policy: PublishPolicy): PublishSettings => ({
  privateContentRelays: policy.privateContentRelays ?? [],
  indexerRelays: policy.indexerRelays ?? [],
  groupRelays: policy.groupRelays ?? [],
  perRecipientCap: requireCountOrAll("perRecipientCap", policy.perRecipientCap ?? Number.POSITIVE_INFINITY),
})

const dmRoute = (event: Event, directory: RelayDirectory): PublishRoute | NoDmRelaysFailure => {
  const relays = unionRelays(...recipientsOf(event).map(({ pubkey }) => directory.relaysOf(pubkey, "dm")))
  return relays.length > 0 ? { branch: "dm", relays } : NO_DM_RELAYS
}

const draftRelays = (event: Event, directory: RelayDirectory, settings: PublishSettings): RelaySet => {
  const privateRelays = directory.permitted(settings.privateContentRelays)
  return privateRelays.length > 0 ? privateRelays : directory.relaysOf(event.pubkey, "outbox")
}

const relaySetOf = (hint: RelayUrl | null): RelaySet => hint === null ? [] : [hint]

const groupRelays = (group: GroupClaim, directory: RelayDirectory, settings: PublishSettings): RelaySet =>
  group.namesGroup ? directory.permitted(relaySetOf(group.hint), settings.groupRelays) : []

const inboxOrHint = (recipient: Recipient, directory: RelayDirectory, cap: number): RelaySet => {
  const inbox = directory.relaysOf(recipient.pubkey, "inbox")
  const candidates = inbox.length > 0 ? inbox : directory.permitted(relaySetOf(recipient.hint))
  return candidates.slice(0, cap)
}

const generalRelays = (event: Event, directory: RelayDirectory, settings: PublishSettings): RelaySet => {
  // Deliberate: NIP-A4 sends a kind 24 to every inbox relay of each receiver, so no cap applies — see ADR-0018
  const cap = event.kind === KIND_PUBLIC_MESSAGE ? Number.POSITIVE_INFINITY : settings.perRecipientCap
  const fanout = recipientsOf(event).map((recipient) => inboxOrHint(recipient, directory, cap))
  const indexers = isIndexedKind(event.kind) ? directory.permitted(settings.indexerRelays) : []
  return unionRelays(directory.relaysOf(event.pubkey, "outbox"), ...fanout, indexers)
}

/**
 * Decide which relays to publish an event to. Branches are tried in order:
 *
 * - `"dm"`: kind 1059 and 21059 gift wraps go to every `p`-tagged recipient's kind 10050
 *   relays; with none to go to, returns `NoDmRelaysFailure` (NIP-17: do not
 *   publish, no fallback).
 * - `"draft"`: kinds 30024 / 31234 go to `privateContentRelays`, or to the
 *   author's outbox when none remains after blocking. Kind 30403, a NIP-99
 *   listing saved as a draft or inactive, is public and routes like any other
 *   event.
 * - `"group"`: an event with an `h` tag naming a non-empty group id is a NIP-29
 *   group event and goes to its group relays: the relay hint its `h` tags agree
 *   on and `groupRelays`, less blocked relays. `h` tags naming different group
 *   ids name no group, and the route then has no relays, as it has when none
 *   remains after blocking. A group event never takes `"general"`.
 * - `"general"`: the author's outbox (NIP-65 write relays), plus every inbox
 *   relay (NIP-65 read relays) of each `p`-tagged recipient, plus
 *   `indexerRelays` for indexed kinds. A recipient with no inbox gets the `p`
 *   tag's relay hint instead, as a best-effort delivery fallback. A kind whose
 *   `p` tags are data, not mentions (`isPubkeyDataKind`: follow lists, NIP-51
 *   lists and sets of people, reports), has no recipients and goes to the
 *   author's outbox only. `perRecipientCap` limits the inbox relays taken per
 *   recipient; by default there is no limit, and a kind 24 public message
 *   (NIP-A4) always goes to every inbox relay of each receiver.
 *
 * Sending the author's kind 10002 to the relays the event went to (NIP-65) is
 * the caller's job. Blocked relays are removed before any choice is made.
 * Throws `RangeError` when `perRecipientCap` is neither a positive integer nor
 * `Infinity`.
 */
export const routePublish = (
  event: Event,
  directory: RelayDirectory,
  policy: PublishPolicy = {},
): PublishRoute | NoDmRelaysFailure => {
  const settings = settingsOf(policy)
  if (isGiftWrapKind(event.kind)) return dmRoute(event, directory)
  if (isDraftKind(event.kind)) return { branch: "draft", relays: draftRelays(event, directory, settings) }
  const group = groupClaimOf(event)
  // Deliberate: a group event keeps the group route with no relays rather than take a public one — see ADR-0011
  if (group !== null) return { branch: "group", relays: groupRelays(group, directory, settings) }
  return { branch: "general", relays: generalRelays(event, directory, settings) }
}
