import type { Filter, FilterPattern, PublicKey } from "./types.ts"
import { isGiftWrapKind } from "./kinds.ts"

const hasSearch = (filter: Filter): boolean => typeof filter.search === "string" && filter.search.length > 0

const giftWrapRecipientOf = (filter: Filter): PublicKey | null => {
  const recipients = filter["#p"] ?? []
  const kinds = filter.kinds ?? []
  const isGiftWrapOnly = kinds.length > 0 && kinds.every(isGiftWrapKind)
  return isGiftWrapOnly && recipients.length === 1 ? recipients[0] ?? null : null
}

const sharedGiftWrapRecipientOf = (filters: ReadonlyArray<Filter>): PublicKey | null => {
  const recipients = filters.map(giftWrapRecipientOf)
  const first = recipients[0] ?? null
  return first !== null && recipients.every((recipient) => recipient === first) ? first : null
}

/**
 * Classify a filter set into the read branch it selects. Any filter with a
 * non-empty `search` string selects `"search"`. Otherwise, if every filter
 * asks only for gift wrap kinds (1059, 21059) and has exactly one `#p`, the
 * same recipient in each, the pattern is `"dmInbox"` and carries that recipient. Everything else,
 * including an empty filter set, is `"general"`.
 */
export const findFilterPattern = (filters: ReadonlyArray<Filter>): FilterPattern => {
  if (filters.some(hasSearch)) return { branch: "search" }
  const recipient = sharedGiftWrapRecipientOf(filters)
  return recipient === null ? { branch: "general" } : { branch: "dmInbox", recipient }
}
