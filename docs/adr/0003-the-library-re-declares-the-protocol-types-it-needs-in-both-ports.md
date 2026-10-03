# 3. The library re-declares the protocol types it needs, in both ports

## Status

Accepted

## Context

`PublicKey`, `EventId`, `RelayUrl`, `Event`, `Filter` and `Tag` all exist already in the nostr-core libraries (`@innis/nostr-core`, `innis/nostr-core`), and this library declares its own copies in each port. That is duplication in the plainest sense, and the obvious correction is to depend on nostr-core and delete the copies.

The reason not to is what the library is for. It is a policy, not a component: it answers "given these relay-list events, which relays should this go to", and it is meant to be embedded in any Nostr client, relay, indexer or back-end. A policy useful in all of those places must not force any of them to adopt a particular Nostr library, or a particular version of one. A consumer on a different major version of nostr-core, on another Nostr library, or on its own types can use this library only because it asks for nothing but the language.

Depending on nostr-core would also invert the direction the ecosystem wants: a routing policy underneath the general-purpose library, usable by it, is worth more than one layered on top of it.

The types are duplicated in the narrowest form routing needs, which keeps the cost small: hex-only keys and ids with no bech32, an event with only the fields routing reads (ADR-0004), and a filter with only `kinds`, `#p` and `search`.

ADR-0002 recorded this for the PHP port alone, with the four-field event ADR-0001 has since been superseded on. This record supersedes ADR-0002 and restates the whole decision for both ports.

## Decision

The library depends on nothing but the language and re-declares the protocol types it needs.

- Adding a runtime dependency of any kind (Nostr, transport, crypto, cache, framework) is a change to what this package is, not a routine addition.
- In TypeScript, `deno.json` `imports` holds only the test-time assertion library `@std/assert`, and no file under `src/` imports anything outside `src/`. The fence: `tests/fences.test.ts` fails if a source file imports anything but a sibling module.
- In PHP, `composer.json` `require` holds `php` and nothing else. The fence: `tests/Compliance/ZeroDependencyFenceTest.php` fails if `require` names anything else.
- Each re-declared type stays scoped to what routing consumes and does not grow toward its nostr-core counterpart.
- Where a re-declared type must agree with nostr-core for values to travel between them (relay URL normalisation, hex validation), the agreement is held by the shared corpus vectors, not by shared code.

## Consequences

- Any host can adopt the routing policy whichever Nostr library it uses, whichever version, or none.
- The types do not interoperate by identity. A consumer holding both libraries' types converts at its boundary, through the hex string for `PublicKey` and `EventId`, and through the URL string for `RelayUrl`. That conversion is the price of the independence and is left to the consumer, the only place that knows both types.
- Normalisation could drift between the two families silently. The corpus is the guard, so a change to URL or key parsing lands in the vectors first.
- Do not "tidy this up" by depending on nostr-core. The duplication is the feature.
- Shared decision: nostr-adrs ADR-0002 (the relay URL agreement held by the corpus).
