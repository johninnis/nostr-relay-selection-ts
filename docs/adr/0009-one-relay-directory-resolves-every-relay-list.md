# 9. One relay directory resolves every relay list

## Status

Accepted

## Context

Almost every routing question starts the same way: find the newest relay list a pubkey published for a kind, read one role's relays from it, and drop the caller's blocked relays. Before this record:

- The core operation "newest relay list for (pubkey, kind), then extract a role" was assembled by hand in about nine places in each port: `newestEventByPubkeyAndKind` with an extractor in TypeScript, `EventSelector::newestByPubkeyAndKind` with a `RelayListExtractor` method in PHP.
- TypeScript's `newestEventByPubkeyAndKind` kept a module-level `WeakMap` index keyed by the caller's array. It gave stale answers when the array was mutated after the first call, and it was hidden state in a library whose premise is statelessness.
- PHP's `AuthorReadRouter` rescanned every event for every author, O(authors x events).
- Six context types each redeclared `relayListEvents` and `blockedRelays`, and the user's relays arrived two ways: pre-extracted for reads, derived from events for publishes.
- A kind and an extractor were chosen separately at each call site (`AuthorRelaySelector::select` took the kind and the parser separately in PHP), so nothing stopped a DM extractor being run on a kind 10002 event.
- A `created_at` tie kept the first-seen list, so the answer depended on array order.

## Decision

One relay directory, built once from the relay-list events and the caller's blocklist, is the only place the library chooses among relay-list events; everything else asks it. In TypeScript `createRelayDirectory(relayListEvents, blockedRelays)` returns a frozen `RelayDirectory`; in PHP `RelayDirectory::fromEvents(EventCollection $relayListEvents, RelaySet $blocked)` returns an immutable `RelayDirectory`.

- It indexes the newest event per (pubkey, kind): the greatest `created_at`, and on a tie the lowest id (NIP-01). The answer does not depend on input order. The directory is a snapshot; it never sees later changes to the caller's array.
- The relay role (`"inbox"`, `"outbox"`, `"dm"`, `"search"`, `"blocked"` in TypeScript; the `RelayRole` enum's `Inbox`, `Outbox`, `Dm`, `Search`, `Blocked` in PHP) owns both the kind a role is read from and its tag rule: inbox and outbox read kind 10002 `r` tags by marker (ADR-0016), DM reads kind 10050, search kind 10007 and blocked kind 10006 `relay` tags. A role cannot be paired with the wrong kind.
- `relaysOf(pubkey, role)` returns that pubkey's relays for the role, normalised, deduplicated and with the blocklist removed.
- `permitted(...sources)` unions any other relay sources (caller relays, indexers, hints, fallbacks) and removes the blocklist. It is the one place a blocklist is subtracted.
- Routing functions take their subject (an event, filters, pubkeys), the directory, and a policy value holding only what the caller decides. The user's own relays come from the directory: reads use the inboxes of the users a `#p` names, then the user's inbox and outbox (ADR-0019), searches the user's kind 10007 list.

## Consequences

- No routing function accepts relay-list events or a blocklist of its own; a second way to resolve a relay list is a defect.
- A blocklist the caller had to decrypt (NIP-51 private entries) enters as the directory's blocklist. Private search relays the caller decrypted go in the read policy's caller relays.
- The directory subtracts its blocklist from every role, including the blocked role itself. To read a public kind 10006 list in order to build a blocklist, extract it from the event's tags with the role before building the directory.
- The index costs one pass over the events per directory. Callers routing many events against the same lists build the directory once and reuse it.
- Shared decision: nostr-adrs ADR-0044.
