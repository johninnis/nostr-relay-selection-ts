# 13. Invalid routing counts are programmer errors

## Status

Accepted

## Context

Three routing inputs are counts: the optional per-recipient inbox cap for publish fan-out, the maximum authors per filter chunk, and the author-read redundancy. They used to accept anything. A cap of `-1` silently dropped the last relay of each recipient in TypeScript and took from the end in PHP; a cap of `0` silently disabled fan-out; a redundancy of `0` behaved like `1` in TypeScript but dropped every author with a relay list in PHP; `maxAuthorsPerFilter` of zero or below silently disabled chunking; and `null` redundancy was a magic value meaning "all".

## Decision

Every count is a positive integer, and an invalid one is rejected loudly. "All relays" is spelled explicitly, never as `null`.

Each port throws its language's argument error:

- In TypeScript, `routePublish` and `routeAuthorReads` throw `RangeError` when `maxAuthorsPerFilter` is not a positive integer, or when `perRecipientCap` or `redundancy` is neither a positive integer nor `Infinity`. `Infinity` means "every relay the recipient or author lists", and is `perRecipientCap`'s default (ADR-0018). A branded positive-integer type was considered and rejected: every caller would have to push literals like `3` through a factory returning `number | null`, and handle a `null` that cannot occur.
- In PHP, `PositiveCount` (authors per filter), `PerRecipientCap` and `Redundancy` are value objects that throw `InvalidArgumentException` from their constructors when the count is below one. `PerRecipientCap::all()`, the publish policy's default (ADR-0018), means "every inbox relay the recipient lists", and `Redundancy::all()` "every relay the author lists". Returning `null` from a parser was rejected: these values are written by the caller's own code, not read from the wire, so a bad one is a programmer error to surface, not an outcome to handle. `PerRecipientCap` and `Redundancy` share a value space but stay two types: each is the type of one policy field and carries that field's one operation (`limit` a recipient's relays, decide whether an author `isReachedAt` a coverage), so a redundancy cannot be passed as a cap, and a single "count or all" type would hold both operations for fields that each need one. Each holds a `PositiveCount`, so the positive-count check is written once.

The corpus pins invalid counts as `{ "error": "invalidArgument" }`, which each port maps to its own argument error, and spells "all" for `perRecipientCap` and `redundancy` as the string `"all"`.

## Consequences

- A routing call can fail fast on a bad policy. Nothing is clamped or reinterpreted.
- Both ports reject the same values, so a configuration that works in one works in the other.
