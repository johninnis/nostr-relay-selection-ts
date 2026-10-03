# 2. The library re-declares the protocol types it needs rather than depending on nostr-core

## Status

Superseded by ADR-0003

## Context

`PublicKey`, `RelayUrl`, `Event`, `Filter` and `Tag` all exist already in `innis/nostr-core`, and this library declares its own copies. That is duplication in the plainest sense: five types, two implementations, one ecosystem. The obvious correction is to require `innis/nostr-core` and delete the copies.

The reason not to is what this library is for. It is a policy, not a component. It answers "given these relay-list events, which relays should this go to" as pure functions, and it is meant to be embedded in any Nostr client, relay, indexer or back-end. A routing policy that is useful in all of those places must not force any of them to adopt a particular Nostr library, or a particular version of one. A consumer already standing on a different major of `nostr-core` — or on no Nostr library at all, or on its own types — can use this library today only because it asks for nothing but PHP.

Depending on `nostr-core` would also invert the dependency direction the ecosystem wants. `nostr-core` is the general-purpose Nostr library; a routing policy sitting underneath it, usable by it, is worth more than one layered on top of it.

The types are duplicated in the narrowest possible form, which is what keeps the cost small:

- `PublicKey` carries the hex form only. Relay selection never needs bech32, so no encoder comes with it.
- `Event` carries kind, pubkey, created_at and tags. There is no id, no signature and no content, because routing reads none of them (see [ADR-0001](0001-the-event-entity-carries-the-four-fields-routing-reads.md)).

The behaviour these types are copied *for* is pinned somewhere better than a shared class. The JSON vectors under `tests/corpus/` are the specification, and any implementation in any language that passes them is conformant — which is how the TypeScript port stays in step without sharing a line of code. `RelayUrl` normalisation in particular is corpus-locked, so a URL normalised by this library and one normalised by `nostr-core` compare equal as strings and the two accept and reject the same inputs.

## Decision

The library depends on nothing but PHP itself, and re-declares the protocol types it needs.

- `composer.json` `require` holds `php` and nothing else. Adding a runtime dependency of any kind — Nostr, transport, crypto, cache, framework — is a change to what this package is, not a routine addition.
- Each duplicated type stays scoped to what routing consumes, and does not grow toward its `nostr-core` counterpart. A field being added is a signal that routing has started reading part of the protocol it was scoped to exclude, and the question to settle first is whether that reading belongs here.
- Where a duplicated type must agree with `nostr-core` for values to travel between the two — `RelayUrl` normalisation, `PublicKey` hex validation — the agreement is held by the corpus vectors, not by shared code.

## Consequences

- Any host can adopt the routing policy regardless of which Nostr library it uses, which version, or whether it uses one at all.
- The types do not interoperate by identity. A consumer holding both this library's `PublicKey` and `nostr-core`'s converts at the boundary through hex, and through the URL string for `RelayUrl`. That conversion is the price of the independence and is deliberately left to the consumer, which is the only place that knows both types.
- Normalisation can drift between the two implementations, and drift would be silent — two libraries quietly disagreeing about whether two relay URLs are the same. The corpus is the guard, so a change to `RelayUrl` or `PublicKey` parsing belongs in the vectors first and the implementation second.
- Do not "DRY this up" by requiring `innis/nostr-core`. The duplication is the feature: it is what lets the policy be embedded anywhere, and it is what lets the same specification be ported to other languages without one of them becoming the canonical implementation.
