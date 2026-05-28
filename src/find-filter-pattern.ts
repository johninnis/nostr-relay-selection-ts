import type { Filter, PublicKey, ReadBranch } from "./types.ts"
import { KIND_GIFT_WRAP } from "./kinds.ts"

const hasSearchFilter = (filters: ReadonlyArray<Filter>): boolean =>
  filters.some((f) => typeof f.search === "string" && f.search.length > 0)

/**
 * If every filter is exactly `{kinds: [1059], "#p": [singleRecipient]}` with
 * the same recipient across all filters, return that `PublicKey`; otherwise
 * `null`. Useful for detecting DM-target reads without invoking the full
 * router.
 */
export const sharedGiftWrapRecipient = (filters: ReadonlyArray<Filter>): PublicKey | null => {
  if (filters.length === 0) return null
  let shared: PublicKey | null = null
  for (const filter of filters) {
    if (filter.kinds?.length !== 1) return null
    if (filter.kinds[0] !== KIND_GIFT_WRAP) return null
    const ptags = filter["#p"]
    if (!ptags || ptags.length !== 1) return null
    const pubkey = ptags[0]
    if (pubkey === undefined) return null
    if (shared === null) shared = pubkey
    else if (shared !== pubkey) return null
  }
  return shared
}

/**
 * Classify a filter set as `"search"`, `"dmInbox"`, or `"general"`. Any filter
 * with a non-empty `search` string yields `"search"`. Otherwise, if every
 * filter is `{kinds: [1059], "#p": [singleRecipient]}` and the recipient is
 * shared across filters, yields `"dmInbox"`. Everything else (including an
 * empty filter set) yields `"general"`. Exposed so callers can inspect the
 * pattern without invoking the full router.
 */
export const findFilterPattern = (filters: ReadonlyArray<Filter>): ReadBranch => {
  if (hasSearchFilter(filters)) return "search"
  if (sharedGiftWrapRecipient(filters) !== null) return "dmInbox"
  return "general"
}
