# 7. The corpus is the specification, and its digest is pinned in both ports

## Status

Accepted

## Context

The policy has two implementations, TypeScript and PHP, that share no code. The JSON vectors under `tests/corpus/` are what makes them the same policy: any implementation that passes every vector is conformant. That only holds while both repositories hold the same vectors.

Drift has already happened: the PHP copy lacked the three NIP-29 group vectors the TypeScript copy had, and the difference went unnoticed because each suite passed against its own copy. Drift is silent by nature; both builds stay green.

Three ways to prevent it were weighed. Sharing the files through a package or submodule adds a dependency to two zero-dependency libraries. Having one repository's CI check out the other and compare couples their builds (a vector added to TypeScript first would turn every PHP pull request red until PHP caught up), and it cannot run in a local test run. Pinning a content digest in each repository runs locally, needs nothing but a hash function, and makes the equality of the two corpora a comparison of one line.

## Decision

- The corpus is the specification. A routing behaviour change lands as new or changed vectors first, then in both implementations.
- The TypeScript repository (`nostr-relay-selection-ts`) owns `tests/corpus/`. After a change there, the whole directory is copied byte-for-byte into the PHP repository (`nostr-relay-selection-php`), including its README and its formatting.
- `tests/corpus/corpus.sha256` pins a digest of every other file in the directory: the lowercase hex SHA-256 of the concatenation, in byte order of relative path, of `<path>\n<sha256 of the file>\n`. `tests/corpus-digest.test.ts` (TypeScript) and `tests/Compliance/CorpusDigestTest.php` (PHP) recompute it and fail when it differs from the pin.
- `normalise-url.json` is also copied byte-for-byte into both nostr-core libraries, whose own compliance tests pin its vector count.

## Consequences

- A vector edited in one repository without the pin fails that repository's build; an edit with an updated pin shows up as two different `corpus.sha256` files. The two repositories are in step exactly when those files are equal, which a reviewer or a release checklist can compare at a glance.
- The PHP copy is formatted as the TypeScript formatter leaves it, not in PHP style; reformatting it changes the digest.
- Documentation inside the corpus directory cannot drift between ports either, because it is part of the digest.
- The digest proves identity, not correctness. Correctness is still the vectors passing in each port.
- Shared decision: nostr-adrs ADR-0043 (the corpus and its digest) and ADR-0002 (`normalise-url.json`).
