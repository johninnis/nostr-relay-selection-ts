# @innis/nostr-relay-selection

[![CI](https://github.com/johninnis/nostr-relay-selection-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/johninnis/nostr-relay-selection-ts/actions/workflows/ci.yml)

Deterministic outbox-model relay routing for Nostr: publish routing, read routing, author set cover, relay hints, zap-request relays and URL classification, as pure functions with zero runtime dependencies. A routing policy locked to a shared JSON corpus, not an engine.

## What it does

When a client publishes a reply, which relays should it send to? When it reads an author's notes, which relays hold them? Which relay hint will work for the person a tag points at? This library answers those questions from the relay lists people publish (NIP-65, NIP-17, NIP-51), deterministically: the same inputs always give the same relays in the same order. It opens no connections, keeps no state and ships no default relays; your relay pool and your fallbacks wrap it. Why it is built that way is recorded in [ADR-0006](docs/adr/0006-the-library-is-a-routing-policy-not-an-engine.md).

The PHP port, [`innis/nostr-relay-selection`](https://github.com/johninnis/nostr-relay-selection-php), implements the same policy against the same corpus.

## Requirements

- Deno 2, Node 20+, Bun 1.0+, or any modern browser
- No runtime dependencies

## Installation

```bash
deno add jsr:@innis/nostr-relay-selection
```

Or for Node / Bun:

```bash
npx jsr add @innis/nostr-relay-selection
```

## Quick start

```ts
import {
  createEvent,
  createRelayDirectory,
  normaliseRelayUrl,
  routePublish,
} from "@innis/nostr-relay-selection"

const relayLists = rawRelayListJson.map(createEvent).filter((event) => event !== null)
const blocked = [normaliseRelayUrl("wss://spam.example.com")].filter((url) => url !== null)
const directory = createRelayDirectory(relayLists, blocked)

const note = createEvent(rawNoteJson)
if (note !== null) {
  const route = routePublish(note, directory, { indexerRelays: [] })
  if ("failure" in route) {
    // a gift wrap whose recipients have no DM relays: do not publish
  } else {
    for (const relay of route.relays) pool.publish(relay, note)
  }
}
```

[`examples/route-relays.ts`](examples/route-relays.ts) is a self-contained, runnable walk through every operation with three synthetic identities. It ships in the published package and needs no permissions:

```bash
deno run examples/route-relays.ts
```

## Types and validation

`RelayUrl`, `PublicKey` and `EventId` are branded strings: strings at run time, distinct types to the compiler, so an unvalidated string cannot reach a routing function. The brands are this library's own. Build them, and the `Event` and `Filter` shapes, with the validation factories, which return `null` on malformed input:

```ts
const pubkey = createPublicKey(hex) // PublicKey | null
const id = createEventId(hex) // EventId | null
const relay = normaliseRelayUrl(url) // RelayUrl | null
const event = createEvent(json) // Event | null: id, kind, pubkey, created_at, tags
const filter = createFilter(json) // Filter | null: kinds, #p, search (other fields dropped)
```

`Event` carries the five fields routing reads. `id` is used only to break a `created_at` tie between two relay lists: the lowest id wins, as NIP-01 specifies. See [ADR-0004](docs/adr/0004-the-event-value-carries-the-five-fields-routing-reads.md), [ADR-0003](docs/adr/0003-the-library-re-declares-the-protocol-types-it-needs-in-both-ports.md) and [ADR-0005](docs/adr/0005-a-relay-url-public-key-or-event-id-is-constructed-only-through-validation.md).

## The relay directory

Every routing function reads relay lists through one `RelayDirectory`, built once from the relay-list events you hold and your blocklist:

```ts
const directory = createRelayDirectory(relayListEvents, blockedRelays)

directory.relaysOf(pubkey, "outbox") // RelaySet
directory.permitted(callerRelays, extraRelays) // union of the sources, minus blocked relays
directory.blocked // the blocklist, deduplicated
```

- For each (pubkey, kind) the directory keeps the newest event: the greatest `created_at`, then the lowest `id`. The result does not depend on the order of `relayListEvents`, and the directory is a snapshot of the array you pass.
- A `RelayRole` names what a list is for and owns the kind it is read from:

  | Role | Kind | Tags read |
  | --- | --- | --- |
  | `"inbox"` | 10002 (NIP-65) | `r` tags not marked `write` (unmarked, `read`, `both` or any other marker), a relay named twice being the union ([ADR-0016](docs/adr/0016-a-relays-nip65-marker-is-read-across-every-r-tag-naming-it-and-an-undefined-marker-is-both.md)) |
  | `"outbox"` | 10002 (NIP-65) | `r` tags not marked `read` (unmarked, `write`, `both` or any other marker), a relay named twice being the union |
  | `"dm"` | 10050 (NIP-17) | `relay` tags |
  | `"search"` | 10007 (NIP-51) | `relay` tags |
  | `"blocked"` | 10006 (NIP-51) | `relay` tags |

- Every relay set the directory returns is normalised, deduplicated and has the blocklist removed, so no routing function ever chooses a blocked relay.

The blocklist is passed in rather than read from a kind 10006 event because NIP-51 lets entries live in encrypted content, which this library cannot decrypt. Read the public entries with `extractRelays(event.tags, "blocked")`, add any you decrypted, and pass the result.

## Route a publish

`routePublish(event, directory, policy?)` returns a `PublishRoute` (`{ branch, relays }`) or, for a gift wrap with nowhere to go, `NoDmRelaysFailure` (`{ failure: "noDmRelays" }`). The branches are tried in this order:

| Branch | When | Relays |
| --- | --- | --- |
| `"dm"` | kind 1059 or 21059 (NIP-59 gift wrap, stored or ephemeral) | Every `p`-tagged recipient's kind 10050 relays. None left: `NoDmRelaysFailure` (NIP-17: do not publish; there is no fallback). |
| `"draft"` | kinds 30024, 30403, 31234 | `privateContentRelays`, or the author's outbox when none remains after blocking. |
| `"group"` | an `h` tag with a group id (NIP-29) | The `h` tag's relay hint and `groupRelays`; no outbox or inbox fan-out. When none remains after blocking, the event falls through to `"general"`. |
| `"general"` | everything else | The author's outbox; plus every inbox relay of each `p`-tagged recipient (NIP-65), or, as a best-effort fallback, the `p` tag's relay hint when the recipient has no inbox; plus `indexerRelays` for indexed kinds (0, 3, 10002, 10050). `perRecipientCap` limits the inbox relays per recipient; by default there is no limit. A kind whose `p` tags are data, not mentions, has no recipients and goes to the author's outbox (and indexers) only: kind 3 (NIP-02 follow list), 1984 (NIP-56 report) and the NIP-51 lists and sets of people, 10000, 10017, 10020, 10054, 10064, 10101, 30000, 30007, 39089 and 39092 (`isPubkeyDataKind`). Every other kind fans out ([ADR-0018](docs/adr/0018-a-public-event-is-also-sent-to-every-inbox-relay-of-each-user-it-tags.md)). |

The outbox is always the event author's (`event.pubkey`). Blocked relays are removed before any choice: a recipient's inbox is deduplicated and cleared of blocked relays before the cap is taken, a blocked hint is ignored, and a draft or group whose relays are all blocked falls back as above ([ADR-0010](docs/adr/0010-blocked-relays-are-removed-before-any-choice-is-made.md)). DM and draft branches come before the group branch, so private content never reaches a group relay ([ADR-0011](docs/adr/0011-private-branches-take-precedence-over-group-routing.md)), and no DM, draft or group message fans out to a tagged user's inbox.

NIP-65 also asks that the author's kind 10002 be sent to every relay the event was published to. That is your job: publish the author's relay list event to the same route.

```ts
const route = routePublish(event, directory, {
  privateContentRelays, // decrypted NIP-37 kind 10013 relays, for drafts
  indexerRelays, // e.g. purplepag.es, for kinds 0, 3, 10002, 10050
  groupRelays, // the relays hosting this event's NIP-29 group, if you know them
  perRecipientCap: 3, // optional cap on inbox relays per recipient; default every one (Infinity)
})
```

A non-DM route may have an empty `relays` when your inputs name no relay (the author has no outbox and you supplied nothing); what to fall back to is your decision. `perRecipientCap` must be a positive integer or `Infinity`; anything else throws `RangeError`.

## Route a read

`routeRead(filters, directory, { userPubkey, callerRelays })` returns a `ReadRoute` or `NoDmRelaysFailure`:

| Branch | When | Relays |
| --- | --- | --- |
| `"search"` | any filter has a non-empty `search` | The user's kind 10007 search relays, then `callerRelays`. |
| `"dmInbox"` | every filter asks only for kinds 1059 and/or 21059 with exactly one `#p`, the same recipient in each | The recipient's kind 10050 relays. None left: `NoDmRelaysFailure`. |
| `"general"` | anything else, including no filters | The inbox relays of every user a `#p` names (NIP-65: events about a user are read from that user's read relays), then the user's inbox and outbox, then `callerRelays`. The user's own relays are read only when no filter has a `#p`, a filter has none, or a tagged user has no inbox left after blocking ([ADR-0019](docs/adr/0019-a-read-about-tagged-users-goes-to-their-inbox-relays.md)). |

`findFilterPattern(filters)` exposes the classification on its own, with the recipient on the `"dmInbox"` pattern.

## Read many authors

`routeAuthorReads(authors, directory, policy?)` plans which outbox relays to read a set of authors from. Greedy set cover groups authors who share a relay; each author is read from up to `redundancy` relays; each route's authors are chunked to at most `maxAuthorsPerFilter`. Authors with no usable outbox (no kind 10002, no write entries, or all blocked) are read from `fallbackRelays` in a final route, which is omitted when no fallback relay remains. No route ever has an empty `relays`.

```ts
for (const route of routeAuthorReads(followed, directory, { fallbackRelays, maxAuthorsPerFilter: 200, redundancy: 3 })) {
  for (const chunk of route.authorChunks) pool.subscribe(route.relays, { kinds: [1], authors: [...chunk] })
}
```

`maxAuthorsPerFilter` (default 200) and `redundancy` (default 3) must be positive integers; `redundancy: Infinity` reads every author from every relay they list. Anything else throws `RangeError` ([ADR-0013](docs/adr/0013-invalid-routing-counts-are-programmer-errors.md)).

## Other operations

| Function | Purpose |
| --- | --- |
| `selectRelayHint(userPubkey, target, directory)` | One relay hint for a tag, else `null`: a relay where the target's events are found ([ADR-0020](docs/adr/0020-a-relay-hint-names-where-its-target-is-found-and-prefers-the-relay-it-was-seen-on.md)). `target` is `{ pubkey, seenOn? }`: `pubkey` is the referenced event's author for an `e` / `q` / `a` tag and the tagged user for a `p` tag; `seenOn` is a relay you received the target from (the event, or an event by the tagged user). The hint is `seenOn` unless blocked, else the target's first outbox relay, else the user's first inbox relay. |
| `selectZapRequestRelays(zapperPubkey, recipientPubkey, directory)` | NIP-57: the zapper's inbox relays, then the recipient's. |
| `recipientsWithoutInbox(event, directory)` | The `p`-tagged recipients publish routing cannot reach through an inbox (no kind 10002, no read entries, or all blocked), for which the `"general"` branch falls back to the `p`-tag hint. Useful for fetching missing relay lists before publishing. Empty for gift wrap and draft kinds and for kinds whose `p` tags are data, which never fan out. |
| `extractRelays(tags, role)` | Read one role's relays from a relay-list event's tags. |
| `relayListKindOf(role)` | The kind a role is read from. |
| `buildRelaySet(...sources)` | Parse raw URL strings into a `RelaySet`: normalised, malformed ones dropped, duplicates collapsed, first-seen order. |
| `unionRelays(...sources)` | Union already-normalised URLs into a `RelaySet`. |
| `subtractRelays(relays, blocked)` | The relays not in `blocked`, deduplicated, in order. |
| `normaliseRelayUrl(url)` | Normalise a relay URL, or `null`. The rules are pinned by `tests/corpus/normalise-url.json`, shared with `@innis/nostr-core`. |
| `isOnionUrl` / `isLoopbackUrl` / `isLocalAddrUrl` / `isInsecureUrl` | URL predicates for your own filtering; routing never applies them. Address ranges match IPv4 dotted quads only, so `wss://10.example.com` is not local; no relay URL holds an IPv6 literal ([ADR-0017](docs/adr/0017-the-url-classifiers-read-only-names-and-ipv4-addresses-because-no-relay-url-holds-an-ipv6-literal.md)). |
| `isGiftWrapKind` / `isDraftKind` / `isIndexedKind` / `isPubkeyDataKind` | The kind groupings routing branches on ([ADR-0015](docs/adr/0015-kind-sets-are-exposed-only-as-predicates.md)). |
| `KIND_*` | The kinds routing distinguishes, and only those ([ADR-0014](docs/adr/0014-a-kind-is-named-only-when-routing-branches-on-it.md)). |

## Caller-owned lists

Three lists can be partly or wholly encrypted, so you pass their relays in rather than the library reading events:

| Kind | NIP | Where it goes |
| --- | --- | --- |
| 10006 blocked relays | NIP-51 | `createRelayDirectory(events, blockedRelays)`; removed from everything. |
| 10007 search relays | NIP-51 | Public entries are read from the directory for the `"search"` branch; add decrypted entries to `callerRelays` for a search query. |
| 10013 private content relays | NIP-37 | `privateContentRelays` on the publish policy, for drafts. |

## Upgrading from 0.1

0.2 replaces the per-function context objects with the directory and small policy objects:

- Build `createRelayDirectory(relayListEvents, blockedRelays)` once and pass it to every call. `routePublish(event, context)` becomes `routePublish(event, directory, policy)`; `routeRead(context)` becomes `routeRead(filters, directory, { userPubkey, callerRelays })`; `routeAuthorReads(context)` becomes `routeAuthorReads(authors, directory, policy)`; `selectRelayHint(context)` becomes `selectRelayHint(userPubkey, target, directory)` (see below); `selectZapRequestRelays` and `recipientsWithoutInbox` (was `missingRelayListPubkeys`) take pubkeys or the event, then the directory.
- `selectAuthorInboxRelays` / `Outbox` / `Dm` become `directory.relaysOf(pubkey, "inbox" | "outbox" | "dm")`; `newestEventByPubkeyAndKind` is gone; `extractInboxRelayUrls` and its siblings become `extractRelays(tags, role)`.
- Routes never have `null` relays. A refused DM is `NO_DM_RELAYS` (`{ failure: "noDmRelays" }`); test with `route === NO_DM_RELAYS` or `"failure" in route`.
- `Event` requires `id`. `ReadContext.userRelayUrls` and `searchRelays` are gone: the user's relays come from the directory.
- `DRAFT_KINDS` and `INDEXED_KINDS` become `isDraftKind` and `isIndexedKind`. `INBOX_FANOUT_KINDS` is gone, with no replacement: see the fan-out entry below.
- Invalid counts throw `RangeError`; `redundancy: null` becomes `redundancy: Infinity`.
- The publish outbox is the event author's (`event.pubkey`), not a caller-supplied user key: `PublishContext.userPubkey` is gone ([ADR-0018](docs/adr/0018-a-public-event-is-also-sent-to-every-inbox-relay-of-each-user-it-tags.md)). The read branch derives the user's relays from the directory.
- NIP-29 group routing (the `"group"` branch) now comes after the DM and draft branches, so an `h`-tagged gift wrap or draft is never sent to a group relay ([ADR-0011](docs/adr/0011-private-branches-take-precedence-over-group-routing.md)).
- Kinds take nostr-core's names: `KIND_PROFILE_METADATA` becomes `KIND_METADATA`, `KIND_BLOCKED_RELAY_LIST` `KIND_BLOCKED_RELAYS_LIST`, `KIND_SEARCH_RELAY_LIST` `KIND_SEARCH_RELAYS_LIST` and `KIND_LONGFORM_DRAFT` `KIND_LONGFORM_CONTENT_DRAFT` ([ADR-0014](docs/adr/0014-a-kind-is-named-only-when-routing-branches-on-it.md)).
- An `r` tag with a marker other than `read` or `write` now counts as both instead of being dropped, and a relay named by several `r` tags is the union of them ([ADR-0016](docs/adr/0016-a-relays-nip65-marker-is-read-across-every-r-tag-naming-it-and-an-undefined-marker-is-both.md)).
- Kind 21059 (the NIP-59 ephemeral gift wrap) is routed like kind 1059: published to the recipients' kind 10050 relays or refused, and a read asking only for gift-wrap kinds with one `#p` is a `"dmInbox"` read. `findFilterPattern` returns a `FilterPattern` object (`{ branch }`, with `recipient` on `"dmInbox"`) instead of a branch string, and `sharedGiftWrapRecipient` is gone.
- Blocked relays are removed before any choice is made, so a blocklist can change the branch, not only the relays: a recipient's inbox is deduplicated and cleared of blocked relays before the cap, a recipient whose inbox is all blocked falls back to the `p`-tag hint, and a draft or group whose relays are all blocked falls back ([ADR-0010](docs/adr/0010-blocked-relays-are-removed-before-any-choice-is-made.md)). `routeAuthorReads` omits the fallback route when no fallback relay remains instead of returning one with no relays ([ADR-0012](docs/adr/0012-only-a-dm-route-can-be-refused-and-a-refusal-is-a-value.md)).
- `recipientsWithoutInbox` reports every recipient publish routing cannot reach through an inbox (no kind 10002, a list with no read entries, or every inbox relay blocked), where `missingRelayListPubkeys` reported only those with no kind 10002.
- `isLoopbackUrl` and `isLocalAddrUrl` match address ranges on dotted-quad IPv4 hosts only: a hostname such as `127.example.com` or `10.example.com` is no longer loopback or local.
- Publish fan-out follows NIP-65: on the `"general"` branch an event of any kind that mentions users goes to every inbox relay of each `p`-tagged recipient, and `perRecipientCap` defaults to every relay instead of 3 (pass a number to keep a cap). The kinds whose `p` tags are data, not mentions, still go to the author's outbox only, as they did in 0.1 where no fan-out kind listed them: kind 3, kind 1984 and the NIP-51 lists and sets of people (10000, 10017, 10020, 10054, 10064, 10101, 30000, 30007, 39089, 39092). `isPubkeyDataKind` names them, and `KIND_REPORTING`, `KIND_MUTE_LIST`, `KIND_GIT_AUTHORS_LIST`, `KIND_MEDIA_FOLLOWS_LIST`, `KIND_FAVOURITE_PODCASTS_LIST`, `KIND_AUTHORED_PODCASTS_LIST`, `KIND_GOOD_WIKI_AUTHORS_LIST`, `KIND_FOLLOW_SET`, `KIND_KIND_MUTE_SET`, `KIND_STARTER_PACK` and `KIND_MEDIA_STARTER_PACK` are new. The kind constants only `INBOX_FANOUT_KINDS` needed (`KIND_SHORT_NOTE`, `KIND_REPOST`, `KIND_REACTION`, `KIND_GENERIC_REPOST`, `KIND_PUBLIC_MESSAGE`, `KIND_COMMENT`, `KIND_HIGHLIGHT`) are removed; take kind constants from `@innis/nostr-core`. `recipientsWithoutInbox` now reports recipients for every kind except gift wraps, drafts and the kinds whose `p` tags are data ([ADR-0018](docs/adr/0018-a-public-event-is-also-sent-to-every-inbox-relay-of-each-user-it-tags.md)).
- A `"general"` read whose filters name users in `#p` reads those users' inbox relays, and the user's own relays only when a filter has no `#p` or a tagged user has no inbox ([ADR-0019](docs/adr/0019-a-read-about-tagged-users-goes-to-their-inbox-relays.md)).
- Sending the author's kind 10002 to the relays an event went to (NIP-65) is the caller's job.
- `selectRelayHint`'s `target` is `{ pubkey, seenOn? }`, and every hint names a relay where its target's events are found: `seenOn` (a relay you received the event, or an event by the tagged user, from), then the target's outbox, then the user's inbox, where 0.1 took the user's outbox relay in the target's inbox, then the target's inbox, then the user's outbox. `pubkey` is the referenced event's author for an `e` / `q` / `a` tag and the tagged user for a `p` tag ([ADR-0020](docs/adr/0020-a-relay-hint-names-where-its-target-is-found-and-prefers-the-relay-it-was-seen-on.md)).
- `isLoopbackUrl` no longer names `::1`: no relay URL can hold an IPv6 literal, so it never matched ([ADR-0017](docs/adr/0017-the-url-classifiers-read-only-names-and-ipv4-addresses-because-no-relay-url-holds-an-ipv6-literal.md)).

## Testing

```bash
deno task ci       # format check, lint, type-check, tests with the coverage floor, exports tested, docs
deno task test     # tests only
deno publish --dry-run
```

The corpus under [`tests/corpus/`](tests/corpus/) is the specification: this repository owns it, the PHP port holds a byte-identical copy, and a pinned digest in both fails the build if they drift ([ADR-0007](docs/adr/0007-the-corpus-is-the-specification-and-its-digest-is-pinned.md)). Its README describes every vector format. It includes signed events imported verbatim from rust-nostr's gossip tests and real published relay lists.

## Architecture decisions

Design rationale, including the choices that read like smells until you know why, lives in [`docs/adr/`](docs/adr/). Read it before changing the code.

## License

MIT License. See LICENSE file for details.
