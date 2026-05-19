import type { RelayUrl } from "./types.ts"
import { normaliseRelayUrl } from "./normalise-url.ts"

const fromRTags = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
  markers: ReadonlyArray<string>,
): ReadonlyArray<RelayUrl> => {
  const result: Array<RelayUrl> = []
  for (const tag of tags) {
    if (tag[0] !== "r" || typeof tag[1] !== "string") continue
    const marker = tag[2] ?? "both"
    if (!markers.includes(marker)) continue
    const normalised = normaliseRelayUrl(tag[1])
    if (normalised) result.push(normalised)
  }
  return result
}

const fromRelayTags = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<RelayUrl> => {
  const result: Array<RelayUrl> = []
  for (const tag of tags) {
    if (tag[0] !== "relay" || typeof tag[1] !== "string") continue
    const normalised = normaliseRelayUrl(tag[1])
    if (normalised) result.push(normalised)
  }
  return result
}

/** Parse `r` tags from a kind 10002 event, keeping `read` and `both` markers (unmarked entries count as `both`). */
export const extractInboxRelayUrls = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<RelayUrl> => fromRTags(tags, ["read", "both"])

/** Parse `r` tags from a kind 10002 event, keeping `write` and `both` markers (unmarked entries count as `both`). */
export const extractOutboxRelayUrls = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<RelayUrl> => fromRTags(tags, ["write", "both"])

/** Parse `relay` tags from a kind 10050 NIP-17 DM relay list event. */
export const extractDmRelayUrls = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<RelayUrl> => fromRelayTags(tags)

/** Parse `relay` tags from a kind 10006 blocked relay list event. */
export const extractBlockedRelayUrls = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<RelayUrl> => fromRelayTags(tags)

/** Parse `relay` tags from a kind 10007 NIP-50 search relay list event. */
export const extractSearchRelayUrls = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<RelayUrl> => fromRelayTags(tags)
