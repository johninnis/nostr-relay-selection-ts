import type {
  Event,
  NoDmRelaysFailure,
  PublishPolicy,
  PublishRoute,
  RelayDirectory,
  RelaySet,
  RelayUrl,
} from "./types.ts"
import { isDraftKind, isGiftWrapKind, isIndexedKind } from "./kinds.ts"
import { normaliseRelayUrl } from "./normalise-url.ts"
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

const groupRelays = (event: Event, directory: RelayDirectory, settings: PublishSettings): RelaySet => {
  const groupTag = event.tags.find((tag) => tag[0] === "h" && (tag[1] ?? "").length > 0)
  if (groupTag === undefined) return []
  const hint = normaliseRelayUrl(groupTag[2])
  return directory.permitted(hint === null ? [] : [hint], settings.groupRelays)
}

const inboxOrHint = (recipient: Recipient, directory: RelayDirectory, cap: number): RelaySet => {
  const inbox = directory.relaysOf(recipient.pubkey, "inbox")
  const candidates = inbox.length > 0 ? inbox : directory.permitted(recipient.hint === null ? [] : [recipient.hint])
  return candidates.slice(0, cap)
}

const generalRelays = (event: Event, directory: RelayDirectory, settings: PublishSettings): RelaySet => {
  const fanout = recipientsOf(event).map((recipient) => inboxOrHint(recipient, directory, settings.perRecipientCap))
  const indexers = isIndexedKind(event.kind) ? directory.permitted(settings.indexerRelays) : []
  return unionRelays(directory.relaysOf(event.pubkey, "outbox"), ...fanout, indexers)
}

/**
 * Decide which relays to publish an event to. Branches are tried in order:
 *
 * - `"dm"`: kind 1059 and 21059 gift wraps go to every `p`-tagged recipient's kind 10050
 *   relays; with none to go to, returns `NoDmRelaysFailure` (NIP-17: do not
 *   publish, no fallback).
 * - `"draft"`: kinds 30024 / 30403 / 31234 go to `privateContentRelays`, or to
 *   the author's outbox when none remains after blocking.
 * - `"group"`: an event with an `h` tag goes to its NIP-29 group relays (the
 *   tag's relay hint and `groupRelays`) when any remains after blocking.
 * - `"general"`: the author's outbox (NIP-65 write relays), plus every inbox
 *   relay (NIP-65 read relays) of each `p`-tagged recipient, plus
 *   `indexerRelays` for indexed kinds. A recipient with no inbox gets the `p`
 *   tag's relay hint instead, as a best-effort delivery fallback. A kind whose
 *   `p` tags are data, not mentions (`isPubkeyDataKind`: follow lists, NIP-51
 *   lists and sets of people, reports), has no recipients and goes to the
 *   author's outbox only. `perRecipientCap` limits the inbox relays taken per
 *   recipient; by default there is no limit.
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
  const group = groupRelays(event, directory, settings)
  if (group.length > 0) return { branch: "group", relays: group }
  return { branch: "general", relays: generalRelays(event, directory, settings) }
}
