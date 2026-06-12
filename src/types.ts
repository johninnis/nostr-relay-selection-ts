declare const relayUrlBrand: unique symbol
/**
 * Normalised relay URL. Branded so raw `string` cannot be passed where a
 * validated relay URL is expected. Construct via `normaliseRelayUrl`.
 */
export type RelayUrl = string & { readonly [relayUrlBrand]: void }

/** Discriminator returned by `routePublish` identifying which policy branch produced the route. */
export type PublishBranch = "general" | "dm" | "draft" | "group"

/** Discriminator returned by `routeRead` / `findFilterPattern` identifying which policy branch matched the filter set. */
export type ReadBranch = "search" | "dmInbox" | "general"

declare const publicKeyBrand: unique symbol
/**
 * 64-character lowercase hex public key. Branded so raw `string` cannot be
 * passed where a validated pubkey is expected. Construct via `createPublicKey`.
 */
export type PublicKey = string & { readonly [publicKeyBrand]: void }

/** Protocol-only Nostr event shape. Narrow by design — the lib reads `kind`, `pubkey`, `tags`, `created_at` and nothing else. */
export interface Event {
  readonly kind: number
  readonly pubkey: PublicKey
  readonly tags: ReadonlyArray<ReadonlyArray<string>>
  readonly created_at: number
}

// The lib's Filter shape covers exactly the fields the routing policy
// consults: kinds, the #p tag, and the NIP-50 search field. NIP-01 defines
// other filter fields (authors, ids, limit, since, until, #e, #a, #d, #t, etc.)
// but none of them affect relay selection. Callers passing wider wire-format
// filters can either project them down to this shape via createFilter, or cast
// directly (`wireFilter as unknown as Filter`) — extra fields are harmless at
// runtime, the lib just won't consult them.
/** Protocol-only filter shape covering the fields the routing policy consults: `kinds`, `#p`, and the NIP-50 `search` field. */
export interface Filter {
  readonly kinds?: ReadonlyArray<number>
  readonly "#p"?: ReadonlyArray<PublicKey>
  readonly search?: string
}

/** Typed input for `routePublish`. See README for field semantics. */
export interface PublishContext {
  readonly userPubkey: PublicKey
  readonly relayListEvents: ReadonlyArray<Event>
  readonly privateContentRelays: ReadonlyArray<RelayUrl>
  readonly indexerRelays: ReadonlyArray<RelayUrl>
  readonly perRecipientCap?: number
  readonly blockedRelays?: ReadonlyArray<RelayUrl>
  /**
   * Relays hosting the NIP-29 group an `h`-tagged event belongs to, resolved by the caller (the
   * `h` tag carries the group id but not its relay). When set and the event has an `h` tag,
   * `routePublish` returns the `"group"` branch targeting these relays only.
   */
  readonly groupRelays?: ReadonlyArray<RelayUrl>
}

/** Typed input for `routeRead`. See README for field semantics. */
export interface ReadContext {
  readonly userRelayUrls: ReadonlyArray<RelayUrl>
  readonly callerRelays: ReadonlyArray<RelayUrl>
  readonly filters: ReadonlyArray<Filter>
  readonly relayListEvents: ReadonlyArray<Event>
  readonly blockedRelays?: ReadonlyArray<RelayUrl>
  readonly searchRelays?: ReadonlyArray<RelayUrl>
}

/** Typed input for `routeAuthorReads`. See README for field semantics. */
export interface AuthorReadRouteContext {
  readonly authorPubkeys: ReadonlyArray<PublicKey>
  readonly relayListEvents: ReadonlyArray<Event>
  readonly fallbackRelays: ReadonlyArray<RelayUrl>
  readonly maxAuthorsPerFilter?: number
  readonly redundancy?: number | null
  readonly blockedRelays?: ReadonlyArray<RelayUrl>
}

/** One entry in the `routeAuthorReads` output: a relay set and the author pubkey chunks to query on it. */
export interface AuthorReadRoute {
  readonly relays: ReadonlyArray<RelayUrl>
  readonly authorChunks: ReadonlyArray<ReadonlyArray<PublicKey>>
}

/** Typed input for `selectRelayHint`. See README for field semantics. */
export interface RelayHintContext {
  readonly targetPubkey: PublicKey
  readonly userPubkey: PublicKey
  readonly relayListEvents: ReadonlyArray<Event>
  readonly blockedRelays?: ReadonlyArray<RelayUrl>
}

/** Typed input for `selectZapRequestRelays` (NIP-57). See README for field semantics. */
export interface ZapRequestContext {
  readonly zapperPubkey: PublicKey
  readonly recipientPubkey: PublicKey
  readonly relayListEvents: ReadonlyArray<Event>
  readonly blockedRelays?: ReadonlyArray<RelayUrl>
}

/** Typed input for `selectAuthorInboxRelays` / `selectAuthorOutboxRelays` / `selectAuthorDmRelays`. */
export interface AuthorRelaysContext {
  readonly authorPubkey: PublicKey
  readonly relayListEvents: ReadonlyArray<Event>
  readonly blockedRelays?: ReadonlyArray<RelayUrl>
}
