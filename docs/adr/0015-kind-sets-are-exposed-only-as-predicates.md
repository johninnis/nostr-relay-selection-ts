# 15. Kind sets are exposed only as predicates

## Status

Accepted

## Context

Routing groups kinds into sets: the gift-wrap kinds, the draft kinds, the kinds indexers harvest, and the kinds whose `p` tags are data rather than mentions. Callers want the same groupings, and the obvious way to share them is to export the sets themselves.

In TypeScript the natural export is a set typed `ReadonlySet<number>`, so that callers cannot change it. `ReadonlySet` is a compile-time view only. At run time the value is an ordinary `Set`, and any caller can write `(INDEXED_KINDS as Set<number>).add(1)`. Because the sets are module-level, that one line changes routing for every caller in the process, and nothing in the library could detect it.

In PHP a public constant array cannot be altered, but it would still give the two ports different public shapes for one decision, and it would commit the library to an iterable list, with an order, that routing never uses: routing only ever asks whether one kind belongs.

## Decision

The kind groupings are exposed only as predicates, never as sets or lists.

- In TypeScript the sets stay private to `src/kinds.ts`, behind `isGiftWrapKind`, `isDraftKind`, `isIndexedKind` and `isPubkeyDataKind`.
- In PHP the groupings are the `EventKind` methods `isGiftWrap`, `isDraft`, `isIndexed` and `isPubkeyData`, each a `match` over its cases, and no constant holds a grouping.

## Consequences

- No caller can alter which kinds a routing branch applies to.
- A caller cannot iterate the groupings. One that needs a list keeps its own.
- There is no fan-out grouping: every kind on the general publish branch fans out unless `isPubkeyDataKind` / `isPubkeyData` names it (ADR-0018). That predicate is a closed list of the kinds a NIP defines as lists or reports of people; do not turn it back into a list of the kinds that fan out.
- Do not "simplify" the predicates into exported sets or constant lists: in TypeScript the type annotation does not make the set immutable, and in either port the two public shapes would stop matching.
