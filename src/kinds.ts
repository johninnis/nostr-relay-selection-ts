/** NIP-01 profile metadata. */
export const KIND_PROFILE_METADATA = 0
/** NIP-01 short text note. */
export const KIND_SHORT_NOTE = 1
/** NIP-02 follow list. */
export const KIND_FOLLOW_LIST = 3
/** NIP-18 repost. */
export const KIND_REPOST = 6
/** NIP-25 reaction. */
export const KIND_REACTION = 7
/** NIP-18 generic repost. */
export const KIND_GENERIC_REPOST = 16
/** NIP-C7 public chat message. */
export const KIND_PUBLIC_MESSAGE = 24
/** NIP-22 threaded comment. */
export const KIND_COMMENT = 1111
/** NIP-59 gift wrap (used for NIP-17 DMs). */
export const KIND_GIFT_WRAP = 1059
/** NIP-84 highlight. */
export const KIND_HIGHLIGHT = 9802
/** NIP-65 relay list (read/write markers). */
export const KIND_RELAY_LIST = 10002
/** NIP-65 blocked relay list. */
export const KIND_BLOCKED_RELAY_LIST = 10006
/** NIP-50 search relay list. */
export const KIND_SEARCH_RELAY_LIST = 10007
/** NIP-17 DM inbox relay list. */
export const KIND_DM_RELAY_LIST = 10050
/** NIP-23 long-form draft. */
export const KIND_LONGFORM_DRAFT = 30024
/** NIP-99 classified listing draft. */
export const KIND_CLASSIFIED_LISTING_DRAFT = 30403
/** NIP-37 private draft event. */
export const KIND_DRAFT_EVENT = 31234

/** Kinds that trigger NIP-65 recipient inbox fanout in the `"general"` publish branch. */
export const INBOX_FANOUT_KINDS: ReadonlySet<number> = new Set([
  KIND_SHORT_NOTE,
  KIND_REPOST,
  KIND_REACTION,
  KIND_GENERIC_REPOST,
  KIND_PUBLIC_MESSAGE,
  KIND_COMMENT,
  KIND_HIGHLIGHT,
])

/** Kinds that dispatch to the `"draft"` publish branch. */
export const DRAFT_KINDS: ReadonlySet<number> = new Set([
  KIND_LONGFORM_DRAFT,
  KIND_CLASSIFIED_LISTING_DRAFT,
  KIND_DRAFT_EVENT,
])

/** Kinds that well-known indexers harvest; `indexerRelays` are unioned into the `"general"` branch for these. */
export const INDEXED_KINDS: ReadonlySet<number> = new Set([
  KIND_PROFILE_METADATA,
  KIND_FOLLOW_LIST,
  KIND_RELAY_LIST,
  KIND_DM_RELAY_LIST,
])
