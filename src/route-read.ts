import type { Filter, NoDmRelaysFailure, PublicKey, ReadPolicy, ReadRoute, RelayDirectory, RelaySet } from "./types.ts"
import { findFilterPattern } from "./filter-pattern.ts"
import { NO_DM_RELAYS } from "./no-dm-relays.ts"

const taggedOf = (filter: Filter): ReadonlyArray<PublicKey> => filter["#p"] ?? []

const generalRelays = (filters: ReadonlyArray<Filter>, directory: RelayDirectory, policy: ReadPolicy): RelaySet => {
  const tagged = [...new Set(filters.flatMap(taggedOf))]
  const taggedInboxes = tagged.map((pubkey) => directory.relaysOf(pubkey, "inbox"))
  const needsUserRelays = tagged.length === 0 ||
    filters.some((filter) => taggedOf(filter).length === 0) ||
    taggedInboxes.some((inbox) => inbox.length === 0)
  const userRelays = needsUserRelays
    ? [directory.relaysOf(policy.userPubkey, "inbox"), directory.relaysOf(policy.userPubkey, "outbox")]
    : []
  return directory.permitted(...taggedInboxes, ...userRelays, policy.callerRelays ?? [])
}

/**
 * Decide which relays to subscribe to for a set of filters, by the branch
 * `findFilterPattern` selects:
 *
 * - `"search"`: the user's kind 10007 search relays, then `callerRelays`.
 * - `"dmInbox"`: the recipient's kind 10050 relays; with none, returns
 *   `NoDmRelaysFailure` (no fallback).
 * - `"general"`: the kind 10002 inbox relays of every `#p`-tagged user (NIP-65:
 *   events about a user are read from that user's read relays), then the user's
 *   kind 10002 inbox and outbox, then `callerRelays`. The user's own relays are
 *   included only when NIP-65 names nothing better: when no filter has a `#p`,
 *   when a filter has none, or when a tagged user has no inbox left after
 *   blocking.
 *
 * Blocked relays are never returned.
 */
export const routeRead = (
  filters: ReadonlyArray<Filter>,
  directory: RelayDirectory,
  policy: ReadPolicy,
): ReadRoute | NoDmRelaysFailure => {
  const pattern = findFilterPattern(filters)
  switch (pattern.branch) {
    case "dmInbox": {
      const relays = directory.relaysOf(pattern.recipient, "dm")
      return relays.length > 0 ? { branch: "dmInbox", relays } : NO_DM_RELAYS
    }
    case "search":
      return {
        branch: "search",
        relays: directory.permitted(directory.relaysOf(policy.userPubkey, "search"), policy.callerRelays ?? []),
      }
    case "general":
      return { branch: "general", relays: generalRelays(filters, directory, policy) }
  }
}
