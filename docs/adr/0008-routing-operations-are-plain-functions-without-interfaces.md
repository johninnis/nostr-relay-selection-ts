# 8. Routing operations are plain functions without interfaces

## Status

Accepted

## Context

Every routing operation (publish, read and author-read routing, the relay hint, the zap request relays, filter classification, the recipients without an inbox) is a function with no interface. In TypeScript each is an exported function: `routePublish`, `routeRead`, `routeAuthorReads`, `selectRelayHint`, `selectZapRequestRelays`, `findFilterPattern`, `recipientsWithoutInbox`. In PHP each is a `final` class of public static methods in `Domain/Service/`: `PublishRouter`, `ReadRouter`, `AuthorReadRouter`, `RelayHintSelector`, `ZapRequestRelaySelector`, `FilterPatternClassifier`, `RecipientsWithoutInboxFinder`, `RecipientExtractor`. The ordinary expectation for a domain capability is an interface beside a stateless implementation, reached by injection, so that a caller can substitute a double and a host can swap the implementation.

These operations have no collaborators to inject, no state and no I/O: each is a pure function of its arguments. More to the point, the function is the product. A host that wants different routing does not want another implementation of this policy; it wants a different policy, which it expresses in its own code around this one. An interface here would have exactly one implementation forever, and a test double of it would replace the very rules the corpus exists to pin.

## Decision

Routing operations are plain functions, with no interfaces and no instances: exported functions in TypeScript, static methods on `final` classes in PHP. Data travels in values (the relay directory, the policies, the routes); behaviour lives in the functions.

A host that needs to substitute routing, for example in its own tests, defines a port around its adapter to this library and doubles that port.

## Consequences

- Callers cannot inject a double of `routePublish` or `PublishRouter` itself. That is intended: the routing rules are tested by the corpus, and a caller's tests should double the caller's own adapter.
- A service that acquires state, I/O or a collaborator no longer fits this record and must become an injected, interface-backed type, with a record superseding this one.
- If a second implementation of one capability ever appears (a genuine strategy), that capability gets an interface then.
