# Nostr Relay Selection

[![CI](https://github.com/johninnis/nostr-relay-selection-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/johninnis/nostr-relay-selection-ts/actions/workflows/ci.yml)

A TypeScript library for routing Nostr events to and from relays. Implements outbox-model publish routing, read routing, author-set-cover, relay hint selection, NIP-65 inbox/outbox/DM list parsing, NIP-17 DM-inbox handling, and URL classification — as pure functions, with zero runtime dependencies.

## Why this library?

When a client publishes a kind 1 reply, *which* relays should it actually send to? When it queries an author's notes, which relays will return them? When it picks a relay hint for an `e` tag, which one will work for the recipient? These are not trivial questions in the outbox model.

`@innis/nostr-relay-selection` answers them as pure functions over the user's relay-list events. It does not open WebSocket connections, does not depend on a relay pool, does not depend on any Nostr type library, and does not depend on any other package. Feed it events and a context, get back a deterministic list of relays.

## Design reasoning: a spec, not an engine

The Nostr ecosystem already has several relay-selection implementations — NDK's `OutboxTracker`, rust-nostr's `gossip` crate, go-nostr's `sdk` hints DB, Coracle's `welshman/router`. They are all *engines*: stateful, heuristic, async, coupled to a pool and to learned data. They make pragmatic, useful tradeoffs, and none of them are deterministic.

This library makes the opposite tradeoff. It is a *policy specification*:

- **Pure functions.** Every operation is stateless. Same inputs, same outputs. No I/O, no time, no randomness.
- **Deterministic by construction.** No `Math.random()` tie-breaks (welshman), no time-decay scoring (go-nostr), no `received_events` counters (rust-nostr), no batch-popularity sort (NDK), no hardcoded fallback URLs.
- **NIP-derived behaviour only.** Every routing decision is grounded in a NIP — NIP-65 for kind 10002, NIP-17 for kind 10050, NIP-57 for zap requests, NIP-50 for search relays. No empirical heuristics that drift from the spec.
- **Zero runtime dependencies.** Runs on Deno, Node, Bun, and any modern browser. Suitable for embedding in any Nostr client, relay, indexer, or back-end without dragging in transport, crypto, caches, or framework code.
- **Plain protocol types.** `Event`, `Filter`, `PublicKey`, `RelayUrl` are defined here as narrow protocol-only shapes. Convert at your application's adapter boundary; the lib never imports your domain types.
- **Behaviour locked to a JSON corpus.** The test vectors under `tests/corpus/` are the spec. Any implementation in any language that passes every vector is conformant. The TypeScript and PHP ports share the corpus; a Go, Kotlin, or Rust port would too.

Engines and specs compose. This library is the policy; an engine wraps it with caching, pool state, fallbacks, scoring, or whatever else a runtime needs. The two layers stay separate so the policy stays portable and auditable.

## Requirements

- Deno 1.40+, Node 20+, Bun 1.0+, or any modern browser
- TypeScript 5.0+ if compiling from source

No runtime dependencies. No system libraries.

## Installation

```bash
deno add jsr:@innis/nostr-relay-selection
```

Or for Node / Bun:

```bash
npx jsr add @innis/nostr-relay-selection
```

## Quick Start

All routing functions are pure. Inputs are typed context objects; outputs are typed route objects (with a branch discriminator + a list of `RelayUrl`) or lists of `RelayUrl` directly.

For a runnable end-to-end demonstration against live relay-list events from four real Nostr identities (loaded from `tests/corpus/real-world/`), see [`example.ts`](example.ts):

```bash
deno run --allow-read example.ts
```

### Branded types and validation factories

`PublicKey` and `RelayUrl` are branded string types — at runtime they're strings, but the compiler treats them as distinct from `string` so raw, unvalidated input cannot be silently routed through the API. To construct them from raw input, use the validation factories:

```ts
import {
  createEvent,
  createFilter,
  createPublicKey,
  normaliseRelayUrl,
} from "@innis/nostr-relay-selection"

const pubkey = createPublicKey(rawHex)        // PublicKey | null
const relay  = normaliseRelayUrl(rawUrl)      // RelayUrl  | null
const event  = createEvent(JSON.parse(raw))   // Event     | null  — validates kind, pubkey, created_at, tags
const filter = createFilter({ kinds: [1] })   // Filter    | null  — validates kinds, #p, search
```

`createEvent` and `createFilter` exist for cases where the wire-format JSON isn't structurally compatible with the lib's branded types — they validate at the boundary and return `null` on malformed input.

If your `NostrEvent` shape from another package is already structurally compatible (e.g. a plain `{kind, pubkey, created_at, tags}` object from a typed Nostr SDK), a type assertion is also acceptable: `routePublish(e as unknown as Event, ctx)`. Use `createEvent` when the input might be untrusted JSON.

### Route a publish

Given an event and the user's relay-list events (kind 10002 / 10050), decide which relays to publish to. Returns a `PublishRoute` whose `branch` reports the policy applied and whose `relays` lists the targets (which may be empty, or `null` for the `"dm"` branch — see below).

- `"general"` — NIP-65 outbox routing for kind 1/6/7/16/24/1111/9802 etc. Fans out to recipient inboxes (capped per recipient). Adds `indexerRelays` for indexed kinds (0, 3, 10002, 10050) — the events indexers like `purplepag.es` harvest.
- `"dm"` — NIP-17 routing for kind 1059 gift-wraps. Targets recipients' kind-10050 inbox relays only. **Returns `branch: "dm"` with `relays: null` if no recipient has a kind 10050 (or every DM relay is blocked)** — per NIP-17, clients SHOULD NOT publish if the recipient has not signalled readiness. There is no fallback.
- `"draft"` — kinds 30024, 30403, 31234. Routes to caller-supplied `privateContentRelays` if any; otherwise falls back to the user's outbox.

```ts
import { routePublish, type PublishContext } from "@innis/nostr-relay-selection"

const context: PublishContext = {
  userPubkey,
  relayListEvents: cachedKind10002And10050Events,
  privateContentRelays: [],   // caller's pre-extracted kind 10013 URLs (see NIP-37 note below)
  indexerRelays: [],
  blockedRelays: callerBlockedRelays,   // caller's pre-extracted kind 10006 URLs
}

const route = routePublish(event, context)
switch (route.branch) {
  case "general": /* NIP-65 outbox fan-out */ break
  case "dm":      /* NIP-17 DM inboxes (or null if recipient has no 10050) */ break
  case "draft":   /* private content relays or user outbox fallback */ break
}
for (const relay of route.relays ?? []) {
  await pool.publish(relay, event)
}
```

The lib does **not** implement NIP-37 itself — kind 10013's relay list is NIP-44-encrypted inside `content`, and decryption requires a signer + crypto, both out of scope here. Callers that want NIP-37-aware draft routing must fetch and decrypt kind 10013 themselves and pass the resulting URLs into `PublishContext.privateContentRelays`.

### Route a read

Given a set of filters, decide which relays to subscribe to. Returns a `ReadRoute` with a `branch` discriminator and a list of relays.

- `"search"` — any filter with a `search` field. Unions caller-supplied `searchRelays` (from the user's kind 10007 list) with `callerRelays`.
- `"dmInbox"` — every filter is `{kinds: [1059], #p: [singleRecipient]}` and the recipient matches across filters. Targets the recipient's kind-10050 inbox relays.
- `"general"` — everything else. Unions the user's relays with `callerRelays`.

```ts
import { routeRead, type ReadContext } from "@innis/nostr-relay-selection"

const context: ReadContext = {
  userRelayUrls: userOutboxRelays,
  callerRelays: relaysPassedToTheQuery,
  filters: [{ kinds: [1] }],
  relayListEvents: cachedRelayLists,
  blockedRelays: callerBlockedRelays,    // pre-extracted kind 10006
  searchRelays: callerSearchRelays,      // pre-extracted kind 10007
}

const route = routeRead(context)
switch (route.branch) {
  case "search":  /* subscribe to search-capable relays */ break
  case "dmInbox": /* subscribe to recipient's DM inboxes */ break
  case "general": /* subscribe to user + caller relays */ break
}
```

### Filter pattern detection

`routeRead` internally calls `findFilterPattern(filters)` to map a filter set to a `ReadBranch`. The primitive is exposed so callers can inspect or branch on the pattern without invoking the full router.

```ts
import { findFilterPattern, type ReadBranch } from "@innis/nostr-relay-selection"

const branch: ReadBranch = findFilterPattern(filters)
// "search" | "dmInbox" | "general"
```

### Author read: greedy set cover

Given a list of author pubkeys, decide which outbox relays cover them. Uses greedy set-cover so two authors who share a relay are queried together; chunks each plan if the author count exceeds `maxAuthorsPerFilter`; falls back to caller-supplied relays for authors with no NIP-65 list.

```ts
import { routeAuthorReads, type AuthorReadRouteContext } from "@innis/nostr-relay-selection"

const context: AuthorReadRouteContext = {
  authorPubkeys: followedPubkeys,
  relayListEvents: cachedRelayLists,
  fallbackRelays: defaultRelays,
  maxAuthorsPerFilter: 200,
  redundancy: 3,
  blockedRelays: callerBlockedRelays,
}

for (const route of routeAuthorReads(context)) {
  for (const chunk of route.authorChunks) {
    await pool.subscribe(route.relays, { kinds: [1], authors: [...chunk] })
  }
}
```

### Pick a relay hint

For `e` / `p` / `q` tags, pick a single relay URL the recipient is likely to read. Prefers the intersection of the user's outbox with the target's inbox, falls back to either side's first relay, returns `null` if neither side has a list.

### URL classification

Pure predicates for use in caller-side filtering. The library does not apply these itself — they're exposed so consumers can compose filters without re-implementing host detection.

```ts
import { isOnionUrl, isLoopbackUrl, isLocalAddrUrl, isInsecureUrl } from "@innis/nostr-relay-selection"

isOnionUrl(url)      // host ends with .onion
isLoopbackUrl(url)   // localhost, 127.0.0.0/8, ::1
isLocalAddrUrl(url)  // loopback OR RFC1918 OR .local mDNS
isInsecureUrl(url)   // ws:// AND not onion
```

### Caller-owned lists (blocked, search, private content)

Three kinds of user-owned data are passed as pre-extracted URL lists rather than as raw events:

| Kind  | NIP   | Field on context                          | Notes                                                              |
|-------|-------|-------------------------------------------|--------------------------------------------------------------------|
| 10006 | NIP-65| `blockedRelays`  (on every context)       | Subtracted from every route output uniformly.                      |
| 10007 | NIP-50| `searchRelays`  (on `ReadContext`)        | Unioned into the `search` branch alongside caller-supplied relays. |
| 10013 | NIP-37| `privateContentRelays` (on `PublishContext`)| Encrypted content — caller must decrypt before passing.            |

For 10006 and 10007 the caller pre-extracts URLs from their cached event using `extractBlockedRelayUrls(event.tags)` or `extractSearchRelayUrls(event.tags)`. For 10013, the caller does NIP-44 decryption themselves and passes the resulting URLs.

This mirrors the existing `userRelayUrls` pattern on `ReadContext`: user-owned data is the caller's responsibility to extract; library policy is to apply.

### Other operations

| Function                       | Purpose                                                                                                  |
|--------------------------------|----------------------------------------------------------------------------------------------------------|
| `selectAuthorInboxRelays`      | Pick inbox relays for one author (kind 10002 `read`/`both` markers).                                     |
| `selectAuthorOutboxRelays`     | Pick outbox relays for one author (kind 10002 `write`/`both` markers).                                   |
| `selectAuthorDmRelays`         | Pick DM relays for one author (kind 10050 `relay` tags).                                                 |
| `selectZapRequestRelays`       | Merge zapper and recipient inbox relays for a zap request (NIP-57).                                      |
| `selectRelayHint`              | Pick one relay URL hint for an `e`/`p`/`q` tag.                                                          |
| `findFilterPattern`            | Classify a filter set as `"search"`, `"dmInbox"`, or `"general"`.                                        |
| `sharedGiftWrapRecipient`      | If every filter is `{kinds: [1059], "#p": [singleRecipient]}` with the same recipient, return that `PublicKey`; otherwise `null`. Useful for detecting DM-target reads without invoking the full router. |
| `missingRelayListPubkeys`      | For inbox-fanout events, list `p`-tagged pubkeys whose relay list you do not yet have cached.            |
| `newestEventByPubkeyAndKind`   | Find the newest event for a given `(pubkey, kind)` tuple in a heterogeneous event array. Used internally by every routing service and exposed for callers building their own cache layers. Returns `Event \| null`.|
| `extractInboxRelayUrls` / `extractOutboxRelayUrls` / `extractDmRelayUrls` | Parse `r` / `relay` tags from kind 10002 / 10050.                       |
| `extractBlockedRelayUrls` / `extractSearchRelayUrls` | Parse `relay` tags from kind 10006 / 10007.                                          |
| `buildRelaySet`                | Merge any number of relay sources into one deduplicated list, preserving first-seen order.               |
| `subtractRelays`               | Remove URLs in a blocklist from a relay set.                                                             |
| `normaliseRelayUrl`            | Normalise an arbitrary URL string. Lowercases scheme and host, strips default ports and trailing slashes. Rejects non-wss(?), fragments, `%20` in paths, malformed hostnames, out-of-range ports, concatenated URLs, and inputs over 200 chars.|
| `isOnionUrl` / `isLoopbackUrl` / `isLocalAddrUrl` / `isInsecureUrl` | Pure URL classification predicates.                                          |
| `createEvent` / `createFilter` | Validate and construct typed `Event` / `Filter` from JSON-shaped input. Return `null` on malformed input.        |
| `createPublicKey`              | Validate a hex string and brand it as `PublicKey`. Returns `null` for malformed hex.                     |

## Routing rules

The complete policy in one place. Each rule is encoded in the source and locked by a corpus vector.

### What goes in the kind constants

A kind appears as a `KIND_*` export **if and only if the routing policy distinguishes it from arbitrary unknown kinds.** Concretely, a kind belongs in `src/kinds.ts` when at least one of these is true:

- It triggers a branch in `routePublish` (a `match` arm or set-membership check).
- It triggers a branch in `routeRead` or `findFilterPattern`.
- It is parsed by an extractor (kind 10002 / 10006 / 10007 / 10050).

The rule is **drives a branch in `routePublish`**, not "has any routing rule." Two NIPs define routing rules for kinds that are nonetheless absent from `kinds.ts`, and that's deliberate:

- **`KIND_DELETION` (5)** — NIP-09 says deletion events should publish to every relay the original event was on. The lib has no event-publication history and tracking that would require state (out of scope: no I/O, no caches). So kind 5 falls through to `"general"` → user's outbox, the best a stateless pure-policy library can offer. Adding a `KIND_DELETION` constant would imply a dedicated branch the lib cannot honestly implement.

- **`KIND_ZAP_REQUEST` (9734)** — NIP-57 routing (zapper-inbox ∪ recipient-inbox) **is** implemented, but as a dedicated service: `selectZapRequestRelays(context)` over `ZapRequestContext`. The kind doesn't belong here because the `kinds.ts` exports are specifically what `routePublish` branches on, and zap requests don't flow through `routePublish` — they're sent to an LNURL HTTP callback per NIP-57 §3, not published through the normal pool. Kind 9734 is in the routing spec; it just enters via a different door.

Pure vocabulary-only constants — `KIND_REPORT` (1984), `KIND_LIVE_ACTIVITY` (30311), `KIND_JOB_REQUEST` (5000-5999), etc. — never enter the routing spec at all. A future kind registry package is the right home for those names. (`KIND_PROFILE_METADATA` (0) and `KIND_FOLLOW_LIST` (3) earned their place by being indexed kinds; the rule remains "drives a routing decision, or out.")

### Publish branches

`routePublish(event, context)` dispatches on event kind into one of three branches. Every output also has the user's `blockedRelays` subtracted.

| Branch | Triggering kinds | Output relays |
|---|---|---|
| `"dm"` | 1059 (`KIND_GIFT_WRAP`) | Per recipient (`p` tag), the recipient's newest kind-10050 inbox relays. **`null`** if no recipient has a kind 10050, or if blocking removes every DM relay (per NIP-17 "shouldn't try"). |
| `"draft"` | 30024 (`KIND_LONGFORM_DRAFT`), 30403 (`KIND_CLASSIFIED_LISTING_DRAFT`), 31234 (`KIND_DRAFT_EVENT`) | `privateContentRelays` if non-empty, otherwise user's outbox (from newest kind 10002, `write`/`both` markers). |
| `"general"` | Everything else | User's outbox, plus — for `INBOX_FANOUT_KINDS` — recipient inbox fanout (capped per recipient), plus — for `INDEXED_KINDS` — `indexerRelays`. |

`INBOX_FANOUT_KINDS` includes: 1, 6, 7, 16, 24, 1111, 9802. For these kinds, every `p`-tagged recipient's newest kind-10002 inbox (`read`/`both` markers; unmarked entries count as `both`) is unioned in. If the recipient has no usable inbox — either because kind 10002 is absent OR because the cached kind 10002 has no `read`/`both` entries (write-only) — the lib falls back to the position-`[2]` relay hint on the `p` tag, if any. Per-recipient cap defaults to 3 (`DEFAULT_PER_RECIPIENT_CAP`).

`INDEXED_KINDS` includes: 0 (`KIND_PROFILE_METADATA`), 3 (`KIND_FOLLOW_LIST`), 10002 (`KIND_RELAY_LIST`), 10050 (`KIND_DM_RELAY_LIST`). When publishing one of these, `indexerRelays` are unioned into the general output so well-known indexers (`purplepag.es`, `user.kindpag.es`, `relay.nos.social`, etc.) see the updated event. The set matches welshman's `INDEXED_KINDS`.

### Read branches

`routeRead(context)` dispatches on filter shape. Pattern detection is exposed as a primitive via `findFilterPattern(filters)`, which returns `ReadBranch` directly. Every output has `blockedRelays` subtracted.

| Branch | Triggering filter shape | Output relays |
|---|---|---|
| `"search"` | Any filter has a non-null `search` field | `searchRelays` ∪ `callerRelays`. |
| `"dmInbox"` | **Every** filter is exactly `{kinds: [1059], "#p": [singleRecipient]}` and the recipient is the same across filters | Recipient's newest kind-10050 inbox relays, or `null` if none are available (see below). |
| `"general"` | Anything else (including no filters) | `userRelayUrls` ∪ `callerRelays`. |

### DM branches return null with no fallback

The DM branches — `"dmInbox"` on `ReadRoute` and `"dm"` on `PublishRoute` — are the only branches whose `relays` can be `null`. Both return null when the recipient has no cached kind-10050 event, when the kind-10050 event extracts to no relays, or when blocking removes every DM relay the recipient declared. There is **no fallback** to `callerRelays`, `userRelayUrls`, or any other source — a gift-wrap publish or subscription cannot quietly redirect to relays the recipient has not authorised without leaking metadata about who the caller is talking to. A null result means "the caller cannot honour this DM; do not act."

The other branches never return null; they may return an empty array if their inputs are all empty (e.g. user has no outbox and the caller supplied no relays), which signals caller misconfiguration rather than a routing refusal:

| `relays` value | Meaning |
|---|---|
| `null` | Branch is `"dm"` / `"dmInbox"` and no DM-relay route exists. By design. Do not act. |
| `[]` | Branch is non-DM and the inputs produced nothing. Caller misconfiguration. |
| non-empty | Use these relays. |

### Unknown kinds

Any kind not specifically named in the policy routes as `branch: "general"` with no recipient fanout and no indexer relays — i.e. to the user's outbox only. This is deliberate: the spec-derived default for an unrecognised kind is "publish to the author's own outbox, nothing more."

Two paths to change that:

- **Adapter layer (preferred for app-specific behaviour).** If your client has its own routing intuition for a new or experimental kind, handle it in the adapter that wraps this library. Inspect `event.kind`, branch as you wish, and feed your selected relays directly into your pool. The library returns its General-branch answer; your adapter overlays your policy on top. This keeps the spec library small and stable.
- **Library (only when the rule belongs in the spec).** If a NIP defines routing for a new kind and the lib should encode that NIP-derived rule for everyone, add a constant to `kinds.ts` and an arm to the relevant branch or set. This adds a corpus vector and a binding decision across every port. Reserve it for behaviour that's a property of the protocol, not of your app.

### Blocklist application

`blockedRelays` is subtracted from every routing output uniformly. The list is the caller's responsibility to pre-extract from kind 10006 events (use `extractBlockedRelayUrls(event.tags)`). The library never connects to relays, so "blocked" here means "filtered out of routing outputs"; the engine layer above the library should also refuse to open connections to these URLs.

### Search relays

`searchRelays` is the caller's pre-extracted list from their kind 10007 event. It is unioned (alongside `callerRelays`) into the `"search"` branch only. It is not consulted for `"general"` or `"dmInbox"` reads.

## Architecture

```
src/
  types.ts                          Event, Filter, PublicKey, RelayUrl, PublishBranch, ReadBranch, all context shapes
  kinds.ts                          KIND_* constants and INBOX_FANOUT_KINDS / DRAFT_KINDS / INDEXED_KINDS sets
  normalise-url.ts                  RelayUrl normalisation
  url-classify.ts                   isOnionUrl / isLoopbackUrl / isLocalAddrUrl / isInsecureUrl
  create-public-key.ts              createPublicKey factory
  create-event.ts                   createEvent validation factory
  create-filter.ts                  createFilter validation factory
  relay-list.ts                     Parse r / relay tags from kind 10002 / 10006 / 10007 / 10050
  event-utils.ts                    Newest-replaceable-event selection
  build-relay-set.ts                buildRelaySet + subtractRelays
  find-filter-pattern.ts            Filter-shape classifier returning ReadBranch
  route-publish.ts                  Pure publish routing (returns PublishRoute)
  route-read.ts                     Pure read routing (returns ReadRoute)
  route-author-reads.ts             Greedy set-cover author fan-out
  select-author-relays.ts           Per-author inbox / outbox / DM selection
  select-zap-request-relays.ts      NIP-57 zap-request relay union
  select-relay-hint.ts              Single-relay hint for an event/profile tag
  diagnostics.ts                    missingRelayListPubkeys
```

There are no classes. Every export is a function (or a type). No internal state.

### Relationship to other Nostr libraries

`@innis/nostr-relay-selection` is the pure policy. Engines wrap it. For TypeScript, that means: this lib slots underneath your relay pool, not next to it. Convert `Event` and `PublicKey` at the adapter boundary.

The PHP port (`innis/nostr-relay-selection`) shares the same JSON corpus. Both implementations are kept in lockstep — a vector that passes in one passes in the other.

## What this library does NOT do

Deliberate omissions. These belong in the engine layer wrapping the lib, not in the lib itself.

- **No empirical scoring.** No `received_events` counters, no time-decay, no popularity sort. The lib treats all spec-derived relays as equally valid; ordering follows the NIP rules and input order only.
- **No fetch tracking / no learning.** The lib does not know what relays you've connected to, succeeded with, or failed against. State is the caller's responsibility.
- **No caching.** Every call re-reads the events you pass in. Cache them yourself if you need to.
- **No randomness, no tie-breaks.** Two calls with the same inputs return the same outputs in the same order. Always.
- **No hardcoded fallback URLs.** If your routing returns empty, the caller decides what to do. The lib will never silently inject `wss://relay.damus.io` or any other default.
- **No pool-state awareness.** Whether a relay is currently connected is invisible to the lib.
- **No transport, no crypto, no I/O.** The lib has no `connect()`, no `publish()`, no `sign()`, no `decrypt()`. Pure data in, pure data out.

## Testing

```bash
deno task check     # type-check mod.ts, example.ts, src/, tests/
deno task lint      # deno lint
deno task test      # full corpus + unit suite
```

The compliance suite loads JSON test vectors under `tests/corpus/`. The corpus is the spec — any divergence between implementations (this lib and the PHP port) is a test failure.

The corpus includes signed events imported verbatim from [`rust-nostr/nostr`](https://github.com/rust-nostr/nostr)'s gossip test suite under `tests/corpus/external-fixtures/rust-nostr/`. Each fixture carries a `source` field naming the upstream test it came from. The imported events are unmodified; our policy outputs are independently derived from the NIPs and may differ from rust-nostr's. Sharing fixture inputs across implementations makes any such divergence inspectable.

## Anti-patterns

- **Calling routing functions directly from many places in your app.** Wrap them in a single adapter so policy lives in one place. If app-specific behaviour (defaults, fallbacks, pool state, home-relay ordering) leaks into the routing call sites, you'll end up with N divergent policy stacks instead of one.
- **Adding app-specific logic to this lib.** If your change needs to know about pool state, default relays, or the home relay, it belongs in the adapter, not here. The lib must remain pure and portable.
- **Adding a routing function without a corresponding test vector.** The corpus is the spec. Add a vector to `tests/corpus/*.json` and the harness picks it up automatically.
- **Putting a new kind into a relay set at the call site.** Add a constant to `kinds.ts` and extend the appropriate set or branch here, so every caller's routing changes consistently.

## License

MIT License. See LICENSE file for details.
