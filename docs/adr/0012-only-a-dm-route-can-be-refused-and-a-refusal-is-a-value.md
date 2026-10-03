# 12. Only a DM route can be refused, and a refusal is a value

## Status

Accepted

## Context

NIP-17 says a client should not send a gift wrap, or subscribe for one, when the recipient has published no DM relays; there is no fallback, because sending to relays the recipient never chose leaks who is talking to whom. The library has to be able to say "do not act".

It used to say so with `null` relays, typed as possible on every branch (`relays: ReadonlyArray<RelayUrl> | null` in TypeScript, `?list<RelayUrl>` in PHP), so every caller wrote `route.relays ?? []` or `$route->getRelays() ?? []`, and the README needed a table to explain `null` against `[]` against a non-empty list. The "subtract blocked, then turn empty into null" step was duplicated in the publish and read routers. The author-read router, meanwhile, emitted routes with no relays when the fallback list was empty or fully blocked.

## Decision

- Publish and read routing return a route or a `NoDmRelaysFailure`, and a route's relays are a non-nullable `RelaySet`. Only the DM branches can produce the failure. A DM route that is returned always names at least one relay.
- In TypeScript, `routePublish` returns `PublishRoute | NoDmRelaysFailure` and `routeRead` returns `ReadRoute | NoDmRelaysFailure`; the failure is the frozen value `NO_DM_RELAYS`, `{ failure: "noDmRelays" }`, exported for comparison.
- In PHP, `PublishRouter::route` returns `PublishRoute|NoDmRelaysFailure` and `ReadRouter::route` returns `ReadRoute|NoDmRelaysFailure`; the failure is the enum `NoDmRelaysFailure` in `Domain/Failure/`, whose one case, `NoDmRelaysFailure::NoDmRelays`, carries no data beyond its backing string `noDmRelays`, the corpus's spelling.
- Every other route carries a relay set that may be empty. An empty set means the inputs named no relay (the author has no outbox and the caller supplied nothing); what to do then is the caller's decision, and the library never invents a relay.
- Author-read routing (`routeAuthorReads`, `AuthorReadRouter::route`) never returns a route whose relays are empty, and in PHP `AuthorReadRoute` rejects one at construction.

## Consequences

- The refusal is part of the return type, so a caller cannot forget to handle it; there is no `null` to coalesce away.
- Adding a fallback to the DM branches (caller relays, the user's relays, defaults) is forbidden by NIP-17 and by this record.
- A consumer that iterated author-read routes and skipped empty ones no longer needs to.
- Shared decision: nostr-adrs ADR-0046.
