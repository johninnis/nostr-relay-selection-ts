# 6. The library is a routing policy, not a routing engine

## Status

Accepted

## Context

The Nostr ecosystem already has several relay-selection implementations: NDK's `OutboxTracker`, rust-nostr's gossip crate, go-nostr's hints database, Coracle's welshman router. They are engines: stateful, heuristic and asynchronous, coupled to a connection pool and to data they learn at run time (event counts, time-decayed scores, connection success). They make useful trade-offs, and none of them is deterministic.

A reader arriving with those in mind expects this library to track relay health, cache relay lists, score relays, randomise ties, and fall back to well-known default relays when a list is missing. It does none of those things, on purpose, and each absence looks like a missing feature.

The question the library answers is narrower: given these relay lists and these caller inputs, which relays does the protocol say to use? That answer can be computed without any state, and a stateless answer can be specified as data, reviewed without running anything, and reproduced exactly in another language.

## Decision

The library is a policy: every operation is a pure function of its arguments.

- No I/O, no clock, no randomness, no state carried between calls, no caching across calls.
- Every routing rule is derived from a NIP: NIP-65 (kind 10002 inbox and outbox), NIP-17 (kind 10050 DM relays), NIP-51 (kind 10006 blocked and kind 10007 search relay lists), NIP-50 (search), NIP-57 (zap requests), NIP-29 (groups), NIP-37 (draft relays supplied by the caller), and NIP-02, NIP-51 and NIP-56 (the kinds whose `p` tags are data, not mentions; ADR-0018). There are no empirical heuristics.
- There are no hard-coded relay URLs. When the inputs name no relay, the answer is an empty relay set (or, for DMs, a refusal), and the caller decides what to fall back to.
- A kind the policy does not name routes to its author's outbox and the inboxes of the users it `p`-tags (ADR-0018), and nothing more. Rules that need state the library does not have, such as NIP-09's "clients SHOULD broadcast deletion request events to other relays which don't have it", are not approximated.
- Outputs are ordered by the NIP rules and the order of the inputs, and ties are broken by rules stated in the specification, so the same inputs always give the same outputs.

## Consequences

- Engines and this policy compose: an engine wraps the policy with pool state, defaults, scoring and fallbacks. That code belongs in the caller's adapter, not here.
- Proposals to add a default relay list, a connection-aware filter, a learned score or a random tie-break are declined here, however useful they are to one client: each would make the answer depend on something other than the arguments.
- Because the policy is data in and data out, it is specified by the JSON corpus (see the corpus record) and ported by passing the same vectors.
- A caller migrating from an engine sees fewer relays than before when relay lists are missing. That is the policy saying "the protocol names nothing here", not a bug.
- Shared decision: nostr-adrs ADR-0042.
