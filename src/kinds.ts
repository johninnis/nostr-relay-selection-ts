/** NIP-01 profile metadata. */
export const KIND_METADATA = 0
/** NIP-02 follow list. */
export const KIND_FOLLOW_LIST = 3
/** NIP-59 gift wrap (used for NIP-17 DMs). */
export const KIND_GIFT_WRAP = 1059
/** NIP-56 report. */
export const KIND_REPORTING = 1984
/** NIP-51 mute list. */
export const KIND_MUTE_LIST = 10000
/** NIP-65 relay list (read/write markers). */
export const KIND_RELAY_LIST = 10002
/** NIP-51 blocked relay list. */
export const KIND_BLOCKED_RELAYS_LIST = 10006
/** NIP-51 search relay list (NIP-50 search relays). */
export const KIND_SEARCH_RELAYS_LIST = 10007
/** NIP-51 git authors list. */
export const KIND_GIT_AUTHORS_LIST = 10017
/** NIP-51 media follows list. */
export const KIND_MEDIA_FOLLOWS_LIST = 10020
/** NIP-17 DM inbox relay list. */
export const KIND_DM_RELAY_LIST = 10050
/** NIP-51 favourite podcasts list. */
export const KIND_FAVOURITE_PODCASTS_LIST = 10054
/** NIP-51 authored podcasts list. */
export const KIND_AUTHORED_PODCASTS_LIST = 10064
/** NIP-51 good wiki authors list. */
export const KIND_GOOD_WIKI_AUTHORS_LIST = 10101
/** NIP-59 ephemeral gift wrap: a kind 1059 gift wrap that relays must not store. */
export const KIND_EPHEMERAL_GIFT_WRAP = 21059
/** NIP-51 follow set. */
export const KIND_FOLLOW_SET = 30000
/** NIP-51 kind mute set. */
export const KIND_KIND_MUTE_SET = 30007
/** NIP-23 long-form draft. */
export const KIND_LONGFORM_CONTENT_DRAFT = 30024
/** NIP-99 classified listing draft. */
export const KIND_CLASSIFIED_LISTING_DRAFT = 30403
/** NIP-37 private draft event. */
export const KIND_DRAFT_EVENT = 31234
/** NIP-51 starter pack. */
export const KIND_STARTER_PACK = 39089
/** NIP-51 media starter pack. */
export const KIND_MEDIA_STARTER_PACK = 39092

const GIFT_WRAP_KINDS: ReadonlySet<number> = new Set([KIND_GIFT_WRAP, KIND_EPHEMERAL_GIFT_WRAP])

const DRAFT_KINDS: ReadonlySet<number> = new Set([
  KIND_LONGFORM_CONTENT_DRAFT,
  KIND_CLASSIFIED_LISTING_DRAFT,
  KIND_DRAFT_EVENT,
])

const PUBKEY_DATA_KINDS: ReadonlySet<number> = new Set([
  KIND_FOLLOW_LIST,
  KIND_REPORTING,
  KIND_MUTE_LIST,
  KIND_GIT_AUTHORS_LIST,
  KIND_MEDIA_FOLLOWS_LIST,
  KIND_FAVOURITE_PODCASTS_LIST,
  KIND_AUTHORED_PODCASTS_LIST,
  KIND_GOOD_WIKI_AUTHORS_LIST,
  KIND_FOLLOW_SET,
  KIND_KIND_MUTE_SET,
  KIND_STARTER_PACK,
  KIND_MEDIA_STARTER_PACK,
])

const INDEXED_KINDS: ReadonlySet<number> = new Set([
  KIND_METADATA,
  KIND_FOLLOW_LIST,
  KIND_RELAY_LIST,
  KIND_DM_RELAY_LIST,
])

/** NIP-59 gift wraps, stored (1059) or ephemeral (21059): the `"dm"` publish branch and `"dmInbox"` reads. */
export const isGiftWrapKind = (kind: number): boolean => GIFT_WRAP_KINDS.has(kind)

/** Kinds that dispatch to the `"draft"` publish branch. */
export const isDraftKind = (kind: number): boolean => DRAFT_KINDS.has(kind)

/** Kinds indexers harvest; `indexerRelays` are unioned into the `"general"` publish branch for these. */
export const isIndexedKind = (kind: number): boolean => INDEXED_KINDS.has(kind)

/**
 * Kinds whose `p` tags are data, not mentions: the NIP-02 follow list, the NIP-51 lists and sets of people, and the
 * NIP-56 report. The `"general"` publish branch sends them to the author's outbox only, never to the tagged users.
 */
export const isPubkeyDataKind = (kind: number): boolean => PUBKEY_DATA_KINDS.has(kind)
