# 5. A relay URL, public key or event id is constructed only through validation

## Status

Accepted

## Context

`RelayUrl`, `PublicKey` and `EventId` carry a string, and every routing rule trusts that the string is valid: a relay URL in canonical form, so that equality is identity; a key or id as 64 lowercase hex characters. If any path let a raw string become one of these types, an unvalidated value could reach routing and two spellings of one relay could count as two.

`PublicKey` and `EventId` are validated by a test that is the whole invariant (64 lowercase hex characters). A relay URL is different: normalisation builds a new string (lower-cased, default port dropped, dot segments resolved), so the value is not checked but produced.

The two languages close the door differently. In TypeScript the three types are strings at run time, branded (`string & { readonly [brand]: void }`, each with its own unique symbol); the brands are this library's own, not `@innis/nostr-core`'s. A brand can be introduced only by a type assertion (`value as PublicKey`), which the type checker cannot verify, or by a type predicate, whose body is the validation. A predicate brands a key or id with no assertion at all, but there is no input value for a predicate to narrow to a normalised URL: the only predicate that could brand it is "normalising this string gives it back unchanged", which normalises every URL twice on the library's hottest path. In PHP the three are value objects, and a public constructor would be a second way in.

## Decision

Each of the three types has exactly one way in, and it is validation: a `RelayUrl` is constructed only as the output of the relay URL normaliser, and a `PublicKey` or `EventId` only by a hex check that returns nothing for an invalid value. No unvalidated string reaches routing.

- In TypeScript, `RelayUrl` has exactly one construction point, the return of `normaliseRelayUrl`, and it is the only type assertion in `src/`. It carries a one-line fence naming this record. The lint rule that forbids an assertion is lifted for `src/normalise-url.ts` alone, in the `lint` task of `deno.json` beside its justification, never by a comment at the site; because that lifts the rule for the whole file, `tests/fences.test.ts` fails if any other assertion to a named type appears in the source. `PublicKey` and `EventId` are introduced by type predicates through `createPublicKey` and `createEventId`, and `Event` and `Filter` are plain object types built structurally by their factories, so no other assertion is needed.
- In PHP, `RelayUrl`, `PublicKey` and `EventId` are `final readonly` classes with a private constructor and one named constructor each, `RelayUrl::tryFromString` (the normaliser) and `PublicKey::tryFromHex` / `EventId::tryFromHex`, which return `null` for invalid input. The private constructor is called nowhere else.

## Consequences

- A second way to construct any of the three, a public constructor in PHP or a second `as` in TypeScript (or a lint suppression for one), is a defect to fix by making a type honest, not by adding a fence.
- Replacing the TypeScript `RelayUrl` assertion with a predicate that normalises twice is possible but doubles the cost of every URL parse; it is not worth it while the corpus pins normalisation idempotency.
- Documentation never recommends asserting or forcing a value into a library type: untrusted input goes through the factories.
