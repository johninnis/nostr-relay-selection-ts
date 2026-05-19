# Relay-Selection Audit Corpus

Language-neutral JSON test vectors. Any implementation of the
nostr-relay-selection spec — in TypeScript, PHP, Kotlin, Go, or
anything else — that passes every vector in this directory is
spec-compliant.

## Why this exists

The lib is a pure, stateless, data-in / data-out specification of Nostr
relay-selection policy. Keeping the spec as plain-JSON test fixtures
means:

- A port in any language doesn't need to reimplement type fixtures or
  mocking; it loads the same JSON and runs identical checks.
- Divergence between two implementations is immediately visible — one
  passes a vector the other fails, and the vector names the behaviour.
- The spec can be reviewed without reading code. Every branch of
  `routePublish` has at least one named vector; reading the corpus
  tells you what the policy is.

## Files

| File | Covers | Function under test |
| --- | --- | --- |
| `normalise-url.json` | Normaliser Specification | `normaliseRelayUrl(url)` |
| `build-relay-set.json` | Dedup + normalise primitive | `buildRelaySet(...sources)` |
| `extract-relay-urls.json` | Tag parsers for kind 10002 / 10050 | `extractInboxRelayUrls`, `extractOutboxRelayUrls`, `extractDmRelayUrls` |
| `route-publish.json` | Publish routing policy | `routePublish(event, context)` |
| `route-read.json` | Read routing policy | `routeRead(context)` |
| `route-author-reads.json` | NIP-65 outbox routes (grouping + chunking + fallback) | `routeAuthorReads(context)` |
| `select-author-inbox-relays.json` | Inbox extraction for one author | `selectAuthorInboxRelays(context)` |
| `select-zap-request-relays.json` | NIP-57 zap request relay union | `selectZapRequestRelays(context)` |
| `select-relay-hint.json` | Per-tag relay hint selection | `selectRelayHint(context)` |
| `missing-relay-list-pubkeys.json` | Silent-gap diagnostic | `missingRelayListPubkeys(event, relayListEvents)` |
| `real-world/*.json` | End-to-end verification on live relay-list events | `selectAuthorInboxRelays`, `selectAuthorOutboxRelays`, `selectAuthorDmRelays` |

The outbox and DM siblings of `selectAuthorInboxRelays`
(`selectAuthorOutboxRelays`, `selectAuthorDmRelays`) are pure
compositions of primitives that already have full corpus coverage
(`newestEventByPubkeyAndKind` + `extractOutboxRelayUrls` /
`extractDmRelayUrls` + `buildRelaySet`); rather than a per-function
synthetic corpus, the `real-world/` fixtures exercise all three
together against actual published NIP-65 / NIP-17 lists.

Every entry in the plan's Test Vector Matrix has at least one
corresponding vector. The full Normaliser Specification test-vector
table appears verbatim in `normalise-url.json`.

## Vector format

Each file is a JSON array of vectors. Each vector has:

- `name` — human-readable description. Harnesses include this in the
  test output so failures point at a specific spec rule.
- One or more input fields, function-specific (see per-file sections
  below).
- `expected` — the function's canonical output.

All vectors are deterministic. The spec guarantees insertion order
across every tier of `buildRelaySet`, so array outputs can be compared
element-for-element.

### `normalise-url.json`

```json
{ "name": "strips default wss port", "input": "WSS://relay.example.com:443/", "expected": "wss://relay.example.com" }
```

`input` is a string or `null`. Implementations that have a distinct
"undefined" value (e.g. JavaScript) should treat it the same as `null`.

### `build-relay-set.json`

```json
{ "name": "...", "input": [["wss://a"], ["wss://b"]], "expected": ["wss://a", "wss://b"] }
```

`input` is the variadic `sources` argument as an array of string
arrays. `expected` is the deduped, normalised result in insertion
order.

### `extract-relay-urls.json`

```json
{ "function": "extractInboxRelayUrls", "name": "...", "tags": [["r", "...", "read"]], "expected": ["..."] }
```

`function` discriminates which of the three extractors to call.
`tags` matches the `Event.tags` structural shape.

### `route-publish.json`

```json
{
  "name": "kind 1 reply fans out to recipient inbox",
  "event": { "kind": 1, "pubkey": "...", "tags": [["p", "..."]], "created_at": 100 },
  "context": {
    "userPubkey": "...",
    "relayListEvents": [...],
    "privateContentRelays": [],
    "indexerRelays": [],
    "perRecipientCap": 3
  },
  "expected": ["wss://..."]
}
```

`perRecipientCap` is optional in `PublishContext`; when omitted from
the vector, the implementation applies its default (`3`).

**Draft kinds.** `DRAFT_KINDS` = {30024, 30403, 31234} (NIP-23, NIP-99,
NIP-37). For any draft kind, `routePublish` uses `privateContentRelays`
exclusively when non-empty; when empty, it falls back to the user's
outbox. `privateContentRelays` is the spec-pure surface for NIP-37
kind-10013 relays; callers populate it from whichever source they have
(decrypted kind-10013 event, a user-configured home relay, etc.). The
spec does not decrypt kind 10013 itself — its relay list lives in
NIP-44-encrypted `content`, and decryption is out of scope here.

**Relay-list kinds.** For kind 10002 (NIP-65 outbox model) and
kind 10050 (NIP-17 DM relay list), `routePublish` unions the user's
outbox with `indexerRelays`. This lets callers propagate relay lists
to NIP-65 indexer relays (purplepag.es etc.) so they remain
discoverable even when the user's outbox is empty (first publish) or
unreachable. `indexerRelays` is the spec-pure surface for this;
callers populate it from their own configured indexer list. For all
other kinds, `indexerRelays` is ignored.

**What the spec does not cover.** Only spec-derived routing: user
outbox (NIP-65), recipient inboxes (NIP-65), recipient DM relays
(NIP-17 — kind 1059 returns the recipient's kind-10050 relays or
empty, per the spec's "do not try" guidance when no kind-10050 is
found), private content relays (NIP-37). Everything else is caller
policy:

- **Client-state heuristics** — "relays we're currently connected to",
  "relays we've seen events from", "top relays by event count" — are
  implementation bookkeeping, not spec. Callers union them onto the
  spec result at their own boundary.
- **Bootstrap/default relay lists** — every client ships its own list
  of fallback relays for cold-start scenarios. The spec does not
  carry a `defaults` field; if the spec has no answer (e.g. DM with no
  recipient kind-10050 and no user kind-10002), the function returns
  an empty array and the caller decides what to fall back to.
- **Caller-mode branching** — "exact relays only", "this is a NIP-50
  search query", "broadcast this event to everywhere I know about" —
  are caller-policy decisions. `routeRead` merges user relays and
  caller relays in the `general` branch; nothing more. `routePublish`
  has no broadcast flag — any kind the lib does not specifically
  branch on (kind 5 deletions, kind 0 profile metadata, kind 3 follow
  lists, etc.) routes through the General branch and returns the
  user's outbox.

### `route-read.json`

```json
{
  "name": "...",
  "context": {
    "userRelayUrls": ["wss://..."],
    "callerRelays": ["wss://..."],
    "filters": [{ "kinds": [1] }],
    "relayListEvents": []
  },
  "expected": { "branch": "general", "relays": ["wss://..."] }
}
```

`routeRead` returns a `ReadRoute` — `branch` is `"search"`,
`"dmInbox"`, or `"general"`. `relays` is the deduped, normalised
list for that branch.

### `route-author-reads.json`

```json
{
  "name": "...",
  "context": {
    "authorPubkeys": [...],
    "relayListEvents": [...],
    "fallbackRelays": ["wss://..."],
    "maxAuthorsPerFilter": 200
  },
  "expected": [
    { "relays": ["wss://alice-outbox"], "authorChunks": [["aliceHex"]] },
    { "relays": ["wss://shared-outbox"], "authorChunks": [["aliceHex", "bobHex"]] },
    { "relays": ["wss://fallback"], "authorChunks": [["carolHex"]] }
  ]
}
```

One plan per distinct outbox relay; each plan's `authorChunks` holds
filter-sized buckets of authors (capped by `maxAuthorsPerFilter`, default
`200`). Authors lacking a kind-10002 surface as a final plan whose
`relays` is the caller-supplied `fallbackRelays`. Plan insertion order
is deterministic (per-pubkey iteration order, then fallback last).

### `select-relay-hint.json`

```json
{ "name": "...", "context": { /* RelayHintContext */ }, "expected": "wss://..." | null }
```

### `missing-relay-list-pubkeys.json`

```json
{ "name": "...", "event": { /* Event */ }, "relayListEvents": [...], "expected": ["..."] }
```

### `real-world/*.json`

Verbatim kind 10002 + kind 10050 events captured from public relays for
real Nostr identities (one file per author). Each fixture has its
expected inbox / outbox / DM extraction baked in, hand-computed from the
raw events. The compliance harness loads each fixture, builds an
`AuthorRelaysContext`, calls all three `selectAuthor*Relays` functions,
and asserts the result.

```json
{
  "name": "Author display name",
  "pubkey": "<hex>",
  "events": [
    { "kind": 10002, /* ... */ },
    { "kind": 10050, /* ... */ }
  ],
  "expected": {
    "inbox":  ["wss://..."],
    "outbox": ["wss://..."],
    "dm":     ["wss://..."]
  }
}
```

These fixtures double as a regression guard against subtle normalisation
or marker-handling changes — divergence from the hand-computed
expectations is a visible failure on real user data, not a synthetic
vector. Update the fixtures verbatim when a captured author republishes
their relay list, and recompute the expected lists by hand.

## Running the corpus

Each port supplies its own test harness over the same JSON. Known
harnesses:

- **TypeScript (Deno)**: `deno test corpus.test.ts`
- **PHP (PHPUnit)**: `composer test`

For a new port: read each `.json` file, deserialise, and for every
vector invoke your implementation of the named function with the
vector's inputs. Assert equality against `expected`.

## Adding a vector

Add the vector to the appropriate `.json` file. For every new branch
of routing policy, add at least one vector. Every harness picks the
vector up automatically — no registration needed.

When the corpus is shared across multiple ports, add the vector once
and propagate the JSON file to every port's copy of the corpus.

## What the corpus deliberately does NOT cover

- Network behaviour, async orchestration, timeouts — the spec is pure
  and these are caller concerns.
- The normaliser's IDN / Punycode handling, percent-encoding in paths,
  userinfo — declared out of scope by the Normaliser Specification.
- Relay connection, publishing, or subscribing — the spec doesn't do
  these; it returns URLs and the caller connects.
- NIP-37 kind-10013 decryption — the encrypted relay list inside
  `content` must be NIP-44-decrypted by the caller; the spec routes
  drafts to whatever the caller provides as `privateContentRelays`.
