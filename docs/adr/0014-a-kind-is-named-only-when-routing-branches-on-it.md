# 14. A kind is named only when routing branches on it

## Status

Accepted

## Context

A library about Nostr events is an obvious place to collect kind constants, and readers regularly propose adding the ones they miss: deletion (5), zap request (9734), live activity (30311). A kind name here, though, is read as a claim that routing treats that kind specially, and a claim the library cannot honour is worse than no name.

## Decision

A kind gets a name (a `KIND_*` constant in TypeScript, an `EventKind` case in PHP) if and only if the routing policy distinguishes it from an unknown kind: it selects a publish branch, is an indexed kind, has `p` tags that are data rather than mentions (ADR-0018), shapes read classification, or is the list kind of a relay role (10002, 10006, 10007, 10050).

- Deletion (5) is excluded: NIP-09 asks clients to "broadcast deletion request events to other relays which don't have it", which needs to know which relays already hold it, publication history this stateless library does not have, so kind 5 routes like any unknown kind.
- Zap request (9734) is excluded: NIP-57 relays for a zap request are computed by the dedicated zap selector, and the request is sent to an LNURL callback, not published through publish routing.
- Vocabulary-only kinds are excluded; a kind registry is the right home for them.
- A named kind takes the name the nostr-core libraries give it, where they name it, so a kind reads the same in this library as in the core a consumer also holds: `KIND_METADATA` / `EventKind::Metadata` (0), `KIND_BLOCKED_RELAYS_LIST` / `BlockedRelaysList` (10006), `KIND_SEARCH_RELAYS_LIST` / `SearchRelaysList` (10007), `KIND_LONGFORM_CONTENT_DRAFT` / `LongformContentDraft` (30024). The earlier names (`KIND_PROFILE_METADATA` / `ProfileMetadata`, `KIND_BLOCKED_RELAY_LIST` / `BlockedRelayList`, `KIND_SEARCH_RELAY_LIST` / `SearchRelayList`, `KIND_LONGFORM_DRAFT` / `LongformDraft`) were renamed for this alone; the values are unchanged. A kind no core names (30403, the NIP-99 classified listing draft) takes its NIP's name; a kind only one core names takes that core's name (31234 `KIND_DRAFT_EVENT` / `DraftEvent`, 1984 `KIND_REPORTING` / `Reporting`, 10101 `KIND_GOOD_WIKI_AUTHORS_LIST` / `GoodWikiAuthorsList` and 39092 `KIND_MEDIA_STARTER_PACK` / `MediaStarterPack`, all from the PHP core).
- The kinds that used to be named only because they fanned out to recipients' inboxes (1, 6, 7, 16, 24, 1111 and 9802; `KIND_SHORT_NOTE` / `ShortNote`, `KIND_REPOST` / `Repost`, `KIND_REACTION` / `Reaction`, `KIND_GENERIC_REPOST` / `GenericRepost`, `KIND_PUBLIC_MESSAGE` / `PublicMessage`, `KIND_COMMENT` / `Comment`, `KIND_HIGHLIGHT` / `Highlight`) are no longer named: every kind on the general publish branch fans out unless its `p` tags are data (ADR-0018), so routing no longer tells them apart from an unknown kind.
- The kinds whose `p` tags are data are named, because publish routing keeps them on the author's outbox: 3 (`KIND_FOLLOW_LIST` / `FollowList`), 1984, and the NIP-51 lists and sets of people, 10000 (`KIND_MUTE_LIST` / `MuteList`), 10017 (`KIND_GIT_AUTHORS_LIST` / `GitAuthorsList`), 10020 (`KIND_MEDIA_FOLLOWS_LIST` / `MediaFollowsList`), 10054 (`KIND_FAVOURITE_PODCASTS_LIST` / `FavouritePodcastsList`), 10064 (`KIND_AUTHORED_PODCASTS_LIST` / `AuthoredPodcastsList`), 10101, 30000 (`KIND_FOLLOW_SET` / `FollowSet`), 30007 (`KIND_KIND_MUTE_SET` / `KindMuteSet`), 39089 (`KIND_STARTER_PACK` / `StarterPack`) and 39092.

## Consequences

- The kind exports are not a kind registry and will not become one.
- Adding a kind means adding the routing rule and its corpus vectors in the same change.
- A new kind takes nostr-core's name for it. Do not rename a kind away from nostr-core's name, even toward a name that reads better here.
