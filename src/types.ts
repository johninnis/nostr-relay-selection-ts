declare const relayUrlBrand: unique symbol
/**
 * Normalised relay URL. Branded so a raw `string` cannot be passed where a
 * validated relay URL is expected. Construct via `normaliseRelayUrl`.
 */
export type RelayUrl = string & { readonly [relayUrlBrand]: void }

declare const publicKeyBrand: unique symbol
/**
 * 64-character lowercase hex public key. Branded so a raw `string` cannot be
 * passed where a validated pubkey is expected. Construct via `createPublicKey`.
 */
export type PublicKey = string & { readonly [publicKeyBrand]: void }

declare const eventIdBrand: unique symbol
/**
 * 64-character lowercase hex event id. Branded so a raw `string` cannot be
 * passed where a validated id is expected. Construct via `createEventId`.
 */
export type EventId = string & { readonly [eventIdBrand]: void }

/**
 * Protocol-only Nostr event: the five fields relay routing reads. `id` is read
 * only to break a `created_at` tie between two relay lists (NIP-01: the lowest
 * id wins). Construct from untrusted JSON via `createEvent`.
 */
export interface Event {
  readonly id: EventId
  readonly kind: number
  readonly pubkey: PublicKey
  readonly created_at: number
  readonly tags: ReadonlyArray<ReadonlyArray<string>>
}

/**
 * Protocol-only filter: the fields read routing consults, `kinds`, `#p` and the
 * NIP-50 `search` field. Construct from untrusted JSON via `createFilter`.
 */
export interface Filter {
  readonly kinds?: ReadonlyArray<number>
  readonly "#p"?: ReadonlyArray<PublicKey>
  readonly search?: string
}

/**
 * Relay URLs with no duplicates, in first-seen order. Every relay list the
 * library returns is a `RelaySet`; build one with `buildRelaySet` (raw strings)
 * or `unionRelays` (already-normalised URLs).
 */
export type RelaySet = ReadonlyArray<RelayUrl>

/**
 * What a relay list is for. Each role owns the kind it is read from and its tag
 * rule: `"inbox"` and `"outbox"` read kind 10002 `r` tags by marker (any marker
 * other than `read` or `write` counts as both), `"dm"` reads kind 10050,
 * `"search"` kind 10007 and
 * `"blocked"` kind 10006 `relay` tags.
 */
export type RelayRole = "inbox" | "outbox" | "dm" | "search" | "blocked"

/**
 * Every author's newest relay lists and the caller's blocklist, indexed once.
 * Built by `createRelayDirectory`; a snapshot of the events it was given.
 */
export interface RelayDirectory {
  /** The caller's blocked relays, subtracted from everything the directory returns. */
  readonly blocked: RelaySet
  /** The pubkey's relays for a role, from their newest list of the role's kind, minus blocked relays. */
  readonly relaysOf: (pubkey: PublicKey, role: RelayRole) => RelaySet
  /** Union the sources in order, dropping duplicates and blocked relays. */
  readonly permitted: (...sources: ReadonlyArray<ReadonlyArray<RelayUrl>>) => RelaySet
}

/** Discriminator on a `PublishRoute` naming the policy branch that produced it. */
export type PublishBranch = "general" | "dm" | "draft" | "group"

/** Discriminator on a `ReadRoute` naming the policy branch that matched the filters. */
export type ReadBranch = "search" | "dmInbox" | "general"

/** Result of `routePublish`: the branch that applied and the relays to publish to. */
export interface PublishRoute {
  readonly branch: PublishBranch
  readonly relays: RelaySet
}

/** Result of `routeRead`: the branch that applied and the relays to subscribe to. */
export interface ReadRoute {
  readonly branch: ReadBranch
  readonly relays: RelaySet
}

/**
 * Returned instead of a route when a gift wrap (publish) or a DM-inbox read has
 * no DM relay to go to. NIP-17: do not publish or subscribe; there is no fallback.
 */
export interface NoDmRelaysFailure {
  readonly failure: "noDmRelays"
}

/** Result of `findFilterPattern`: the read branch a filter set selects, with the recipient for `"dmInbox"`. */
export type FilterPattern =
  | { readonly branch: "search" }
  | { readonly branch: "dmInbox"; readonly recipient: PublicKey }
  | { readonly branch: "general" }

/** Caller-supplied inputs to `routePublish` beyond the event and the directory. */
export interface PublishPolicy {
  /** Private relays for draft kinds (e.g. decrypted NIP-37 kind 10013 entries). */
  readonly privateContentRelays?: ReadonlyArray<RelayUrl>
  /** Indexer relays unioned in when publishing an indexed kind (0, 3, 10002, 10050). */
  readonly indexerRelays?: ReadonlyArray<RelayUrl>
  /** Caller-resolved relays hosting the NIP-29 group of an `h`-tagged event. */
  readonly groupRelays?: ReadonlyArray<RelayUrl>
  /** Most inbox relays taken per recipient; a positive integer or `Infinity` for all, default all (NIP-65). */
  readonly perRecipientCap?: number | undefined
}

/** Caller-supplied inputs to `routeRead` beyond the filters and the directory. */
export interface ReadPolicy {
  /** Whose relay lists back the `"general"` and `"search"` branches; for `#p` filters, only as described on `routeRead`. */
  readonly userPubkey: PublicKey
  /** Relays the query itself names, unioned into the `"general"` and `"search"` branches. */
  readonly callerRelays?: ReadonlyArray<RelayUrl>
}

/** Caller-supplied inputs to `routeAuthorReads` beyond the authors and the directory. */
export interface AuthorReadPolicy {
  /** Relays for authors with no usable outbox; no fallback route is emitted when this is empty after blocking. */
  readonly fallbackRelays?: ReadonlyArray<RelayUrl>
  /** Most authors per filter chunk; a positive integer, default 200. */
  readonly maxAuthorsPerFilter?: number | undefined
  /** Relays each author should be read from; a positive integer or `Infinity` for all, default 3. */
  readonly redundancy?: number | undefined
}

/** One entry in the `routeAuthorReads` output: a relay set and the author chunks to query on it. */
export interface AuthorReadRoute {
  readonly relays: RelaySet
  readonly authorChunks: ReadonlyArray<ReadonlyArray<PublicKey>>
}
