# Relay-Selection Corpus

Language-neutral JSON test vectors. They are the specification of the relay-selection policy: any implementation, in any language, that passes every vector in this directory is conformant. The TypeScript package (`@innis/nostr-relay-selection`) and the PHP package (`innis/nostr-relay-selection`) both run their whole test suite against this directory.

## Why this exists

The library is a pure, stateless, data-in / data-out policy. Keeping the policy as JSON fixtures means:

- A port in any language loads the same JSON and runs identical checks; it needs no shared code.
- Divergence between two implementations is immediately visible: one passes a vector the other fails, and the vector names the behaviour.
- The policy can be reviewed without reading code. Every routing branch has at least one named vector.

## Ownership and drift

The TypeScript repository owns this directory. A behaviour change lands here first, as new or changed vectors, and only then in the implementations. The whole directory is then copied byte-for-byte into the PHP repository, including this README.

`corpus.sha256` pins the directory's content. Both test suites recompute the digest and fail when it differs from the pinned value, so a vector edited in one repository without being copied, or copied without the pin, fails that repository's build. Two repositories are in step exactly when their `corpus.sha256` files are equal. The digest is computed as follows:

1. List every file under `tests/corpus/`, recursively, except `corpus.sha256` itself, as paths relative to `tests/corpus/` with `/` separators.
2. Sort the paths by byte value.
3. For each path, append `<path>\n<lowercase hex SHA-256 of the file's bytes>\n`.
4. The digest is the lowercase hex SHA-256 of the concatenation; `corpus.sha256` holds it followed by a newline.

After editing any file here, recompute the digest (run the TypeScript suite and copy the value its failure reports), update `corpus.sha256`, and copy the directory to the PHP repository.

`normalise-url.json` is also copied byte-for-byte into `innis/nostr-core` and `@innis/nostr-core`, so the two families of libraries agree on relay identity.

## Files

| File | Covers | Operation under test |
| --- | --- | --- |
| `normalise-url.json` | Relay URL normalisation and rejection, plus idempotency of every canonical output | `normaliseRelayUrl` / `RelayUrl::tryFromString` |
| `build-relay-set.json` | Parsing raw URL strings into a deduplicated relay set | `buildRelaySet` / `RelaySet::fromStrings` |
| `extract-relay-urls.json` | Reading one role's relays from a relay-list event's tags | `extractRelays` / `RelayRole::extract` |
| `relays-of.json` | Newest list per (pubkey, kind), the NIP-01 tie-break, every role, blocklist subtraction | `RelayDirectory.relaysOf` |
| `route-publish.json` | Publish routing: branch precedence, fan-out, kinds whose `p` tags are data, cap, blocklist, drafts, groups, DM refusal, invalid caps | `routePublish` / `PublishRouter::route` |
| `route-read.json` | Read routing: search, DM inbox, general, tagged users' inboxes, DM refusal | `routeRead` / `ReadRouter::route` |
| `route-author-reads.json` | Greedy set cover, redundancy, chunking, fallback, invalid counts | `routeAuthorReads` / `AuthorReadRouter::route` |
| `select-relay-hint.json` | One relay hint for a tag (`e` / `q` / `a` / `p`) | `selectRelayHint` / `RelayHintSelector::select` |
| `select-zap-request-relays.json` | NIP-57 zap request relays | `selectZapRequestRelays` / `ZapRequestRelaySelector::select` |
| `recipients-without-inbox.json` | Recipients publish routing cannot reach through an inbox | `recipientsWithoutInbox` / `RecipientsWithoutInboxFinder::find` |
| `find-filter-pattern.json` | Classifying a filter set into a read branch | `findFilterPattern` / `FilterPatternClassifier::classify` |
| `classify-url.json` | Onion, loopback, local-address and insecure predicates | `isOnionUrl` etc. / `RelayUrl::isOnion` etc. |
| `create-event.json` | Validating JSON-shaped events | `createEvent` / `Event::tryFromRaw` |
| `create-filter.json` | Validating JSON-shaped filters | `createFilter` / `Filter::tryFromRaw` |
| `real-world/*.json` | Inbox, outbox and DM relays of real published relay lists | `RelayDirectory.relaysOf` |
| `external-fixtures/rust-nostr/*.json` | Signed events imported verbatim from rust-nostr's gossip tests, reused by other vectors | none directly |
| `corpus.sha256` | The content digest described above | the digest check in each suite |

## Shared shapes

Every vector has a `name`; some also carry a `source` naming where their input came from.

An **event** is `{ "id", "kind", "pubkey", "created_at", "tags" }`. `id` and `pubkey` are 64 lowercase hex characters. Routing never verifies ids or signatures; `id` is read only to break a `created_at` tie between relay lists.

A **directory** is `{ "relayListEvents": [event, ...], "blockedRelays": ["wss://...", ...] }`. An implementation builds its relay directory from these two fields. The newest event per (pubkey, kind) is the one with the greatest `created_at`; on a tie the lowest `id` wins (NIP-01). Every relay the directory yields has `blockedRelays` removed.

A **role** is one of `"inbox"` and `"outbox"` (kind 10002 `r` tags: a `read` marker is inbox only, a `write` marker outbox only, and an absent marker or any other marker, `both` among them, is both; a relay named by several `r` tags, compared by canonical URL, is the union of them, as nostr-adrs ADR-0108 decides), `"dm"` (kind 10050), `"search"` (kind 10007) and `"blocked"` (kind 10006), the last three read from `relay` tags.

An **expected routing outcome** is one of:

- `{ "branch": "...", "relays": [...] }`: a route. `relays` has no duplicates and is in the order the policy produces.
- `{ "failure": "noDmRelays" }`: the DM branch had no relay to use and refused (NIP-17: do not publish or subscribe, no fallback).
- `{ "error": "invalidArgument" }`: the policy input is invalid (a count that is not a positive integer). Implementations throw their language's argument error (`RangeError`, `InvalidArgumentException`).

## Vector formats

### `normalise-url.json`

```json
{ "name": "...", "input": "WSS://relay.example.com:443/", "expected": "wss://relay.example.com" }
```

`input` is a string or `null`; `expected` is the canonical URL or `null` when the input is rejected. Implementations with a distinct undefined value treat it as `null`. Every non-null `expected` must normalise to itself.

### `build-relay-set.json`

```json
{ "name": "...", "input": [["wss://a"], ["wss://b"]], "expected": ["wss://a", "wss://b"] }
```

`input` is a list of sources, each a list of raw strings. Each string is normalised, malformed ones are dropped, and duplicates collapse to their first occurrence.

### `extract-relay-urls.json`

```json
{ "role": "inbox", "name": "...", "tags": [["r", "wss://...", "read"]], "expected": ["wss://..."] }
```

### `relays-of.json`

```json
{ "name": "...", "pubkey": "<hex>", "role": "inbox", "directory": { ... }, "expected": ["wss://..."] }
```

### `route-publish.json`

```json
{
  "name": "...",
  "event": { ... },
  "directory": { ... },
  "policy": { "privateContentRelays": [], "indexerRelays": [], "groupRelays": [], "perRecipientCap": 3 },
  "expected": { "branch": "general", "relays": ["wss://..."] }
}
```

`perRecipientCap` is optional: a positive integer or `"all"`, default `"all"`, the most inbox relays taken per recipient. In the `general` branch an event goes to the author's outbox and to the inbox of every `p`-tagged recipient (NIP-65), falling back to the `p` tag's relay hint, as best-effort delivery, for a recipient with no inbox. A kind whose `p` tags are data, not mentions, has no recipients and goes to the author's outbox only: kind 3 (NIP-02 follow list), kind 1984 (NIP-56 report), and the NIP-51 lists and sets of people, kinds 10000, 10017, 10020, 10054, 10064, 10101, 30000, 30007, 39089 and 39092. The publisher's outbox is the event author's (`event.pubkey`). Branches are tried in this order: `dm` (kind 1059 or 21059, the NIP-59 stored and ephemeral gift wraps), `draft` (kinds 30024, 30403, 31234), `group` (an `h` tag whose group relays, from the tag's relay hint and `groupRelays`, are not all blocked), then `general`. Blocked relays are removed before any choice is made: before the per-recipient cap is taken, before the `p`-tag hint fallback is considered, before `privateContentRelays` is judged empty, and before group relays are judged empty.

### `route-read.json`

```json
{
  "name": "...",
  "filters": [{ "kinds": [1] }],
  "directory": { ... },
  "policy": { "userPubkey": "<hex>", "callerRelays": ["wss://..."] },
  "expected": { "branch": "general", "relays": ["wss://..."] }
}
```

`general` reads the kind 10002 inbox of every user named in a `#p` (first-seen order across the filters), then the user's kind 10002 inbox and outbox, then `callerRelays`. The user's own relays are read only when no filter has a `#p`, when any filter has none, or when a tagged user has no inbox after blocking. `search` reads the user's kind 10007 relays, then `callerRelays`. `dmInbox` is selected when every filter asks only for kinds 1059 and/or 21059 and has exactly one `#p`, the same recipient in each; it reads that recipient's kind 10050 relays, or refuses.

### `route-author-reads.json`

```json
{
  "name": "...",
  "authors": ["<hex>", ...],
  "directory": { ... },
  "policy": { "fallbackRelays": ["wss://..."], "maxAuthorsPerFilter": 200, "redundancy": 3 },
  "expected": [{ "relays": ["wss://..."], "authorChunks": [["<hex>", ...]] }]
}
```

`maxAuthorsPerFilter` (default `200`) and `redundancy` (default `3`) are optional. `redundancy` is a positive integer or `"all"`, meaning every relay an author lists. Routes come in greedy-cover pick order; ties go to the relay first seen when walking the authors in input order and each author's outbox in list order. Authors without a usable outbox form a final fallback route, which is omitted when no fallback relay survives the blocklist. No route has an empty `relays`.

### `select-relay-hint.json`

```json
{ "name": "...", "userPubkey": "<hex>", "targetPubkey": "<hex>", "seenOn": "wss://...", "directory": { ... }, "expected": "wss://..." }
```

`targetPubkey` is whose events the hint should find: the referenced event's author for an `e` / `q` / `a` tag, the tagged user for a `p` tag. `seenOn`, optional, is a relay the caller received the target from (the referenced event, or an event by the tagged user); a harness normalises it as a caller constructs any relay URL. Every hint names a relay where the target's events are found (NIP-02, NIP-10, NIP-18, NIP-19): `seenOn` unless it is blocked, else the target's first outbox relay, else the user's first inbox relay. `expected` is `null` when no candidate remains.

### `select-zap-request-relays.json`

```json
{ "name": "...", "zapperPubkey": "<hex>", "recipientPubkey": "<hex>", "directory": { ... }, "expected": ["wss://..."] }
```

### `recipients-without-inbox.json`

```json
{ "name": "...", "event": { ... }, "directory": { ... }, "expected": ["<hex>"] }
```

For every kind except the gift wrap kinds (1059, 21059), the draft kinds (30024, 30403, 31234) and the kinds whose `p` tags are data (listed under `route-publish.json`), the `p`-tagged recipients (first occurrence, malformed pubkeys skipped) whose inbox is empty after blocking: exactly the recipients the `general` publish branch falls back to the `p`-tag hint for. One vector per data kind pins that list.

### `find-filter-pattern.json`

```json
{ "name": "...", "filters": [{ "kinds": [1059], "#p": ["<hex>"] }], "expected": "dmInbox" }
```

### `classify-url.json`

```json
{ "name": "...", "input": "ws://127.0.0.1", "isOnion": false, "isLoopback": true, "isLocalAddr": true, "isInsecure": true }
```

Address ranges are matched only on IPv4 dotted-quad hosts; a hostname such as `10.example.com` is not local.

### `create-event.json` and `create-filter.json`

```json
{ "name": "...", "input": { ... }, "valid": true }
```

### `real-world/*.json`

Verbatim kind 10002 and kind 10050 events captured from public relays, one file per author, with the expected inbox, outbox and DM relays computed by hand from the raw events:

```json
{
  "name": "Author display name",
  "pubkey": "<hex>",
  "events": [{ "kind": 10002, ... }, { "kind": 10050, ... }],
  "expected": { "inbox": ["wss://..."], "outbox": ["wss://..."], "dm": ["wss://..."] }
}
```

They guard against normalisation and marker-handling regressions on real data. When an author republishes their relay list, replace the events verbatim and recompute the expectations by hand.

## Running the corpus

- **TypeScript (Deno)**: `deno task test` runs `tests/corpus.test.ts`, `tests/corpus-real-world.test.ts` and `tests/corpus-digest.test.ts`.
- **PHP (PHPUnit)**: `composer test` runs the `Compliance` suite.

A new port reads each file, builds its own inputs from the shared shapes above, invokes its implementation, and compares the result with `expected`.

## Adding a vector

Add it to the appropriate file in the TypeScript repository, run both suites, update `corpus.sha256`, and copy the directory to the PHP repository. Every harness picks the vector up automatically.

## What the corpus does not cover

- Network behaviour, connection handling and timeouts: the library returns URLs and the caller connects.
- Signature or id verification: events are trusted to be what they claim.
- NIP-37 kind 10013 or NIP-51 private-list decryption: callers decrypt and pass the resulting relays in (`privateContentRelays`, `blockedRelays`).
- Internationalised hostnames: non-ASCII input is rejected, not converted to punycode.
