# 18. A public event is also sent to every inbox relay of each user it tags

## Status

Accepted

## Context

NIP-65 says that when publishing an event clients SHOULD send it to the author's write relays and "to all read relays of each tagged user", and that they SHOULD send the author's kind 10002 "to all relays the event was published to". NIP-A4 makes the second rule a MUST for a kind 24 public message.

The general publish branch used to fan out only for a fixed set of kinds (1, 6, 7, 16, 24, 1111 and 9802), and took at most three inbox relays per recipient by default. NIP-65 names neither a kind set nor a cap: a reaction to a kind 30023 article, a kind 0 that mentions someone, or any kind defined after the set was written did not reach the tagged user, and a user who lists five read relays was reached on three.

Not every `p` tag tags a user in NIP-65's sense, though. NIP-02 defines a kind 3 follow list as "a list of `p` tags, one for each of the followed/known profiles", each with "a relay URL where events from that key can be found". NIP-51 defines its lists and sets of people the same way: the `p` tags of a mute list, a follow set or a starter pack are the list's entries. NIP-56 puts a report's `p` on the user being reported, with the report type, not a relay, as its third element. These `p` tags are data, not mentions. Sending a follow list to the inbox of every user it follows delivers nothing any of them asked for and costs a connection per followed relay; sending a report or a mute list to its subject's inbox delivers it to the very user it is about. welshman routes follow lists, mute lists and reports to the author's outbox only ("their p-tags are data, not recipients"), and applesauce publishes contact and mute lists to the author's outboxes only.

## Decision

The library follows NIP-65 for every event that mentions users, and treats the `p` tags of a list or report of people as data (user rulings, 2026-10-02).

- On the general publish branch, an event goes to its author's outbox and to every inbox relay (kind 10002 read relay) of each `p`-tagged user, deduplicated in tag order. There is no fan-out kind set; `INBOX_FANOUT_KINDS` (TypeScript) and `EventKind::isInboxFanout` (PHP) are removed.
- The outbox a published event goes to is its author's, read from the event itself (`event.pubkey` in TypeScript, `$event->getPubkey()` in PHP); the publish policy takes no user key, and the draft branch's fallback outbox is the author's too. Earlier versions took the key from the caller as `userPubkey`, which sent an event published on someone else's behalf (several accounts, a bunker, a republished relay list) to the wrong outbox, a second source of truth for what the event already states.
- A kind whose `p` tags are data has no recipients: it goes to its author's outbox only (and to `indexerRelays` when it is an indexed kind, as kind 3 is), with no inbox fan-out and no `p`-tag hint. The kinds are kind 3 (NIP-02 follow list), kind 1984 (NIP-56 report), and every NIP-51 list or set whose expected tag items are `p` tags: 10000 (mute list), 10017 (git authors), 10020 (media follows), 10054 (favourite podcasts), 10064 (authored podcasts), 10101 (good wiki authors), 30000 (follow sets), 30007 (kind mute sets), 39089 (starter packs) and 39092 (media starter packs). Each is named (ADR-0014), and the list is exposed only as the predicate `isPubkeyDataKind` (TypeScript) / `EventKind::isPubkeyData` (PHP) (ADR-0015). Every other kind fans out: a kind 30023 article's `p` tags are mentions.
- The per-recipient cap defaults to all. A caller may still opt into a cap: `perRecipientCap` a positive integer (TypeScript), `new PerRecipientCap(n)` (PHP). `Infinity` and `PerRecipientCap::all()` spell "all" explicitly.
- Blocked relays are removed before the cap is taken (ADR-0010). A recipient with no inbox left after blocking gets the `p` tag's relay hint instead, unless the hint is blocked. That is a best-effort delivery fallback, not what the hint means: a `p` hint names where the tagged user's events are found (ADR-0020), and it is used here only because it is the one relay the event names for a user whose relay list the caller does not have.
- The gift wrap, draft and group branches keep their precedence and rules and never fan out: a gift wrap goes only to its recipients' kind 10050 relays, a draft only to private relays or the author's outbox, and a group message only to its group relays (ADR-0011). Private content never reaches a tagged user's public inbox.
- `recipientsWithoutInbox` and `RecipientsWithoutInboxFinder::find` report recipients for every kind except the gift wrap, draft and pubkey-data kinds, exactly the recipients the general branch sends to a `p`-tag hint.
- Sending the author's kind 10002 to every relay the event was published to is the caller's job. The library returns relays and does not publish; the caller holds the author's relay list event and publishes it to the same route.

## Consequences

- An event is routed the same way whoever hands it to the library. Do not add a user key back to the publish policy; read routing keeps `userPubkey`, because a read has no author.
- A follow list, a NIP-51 list or set of people, or a report reaches the author's outbox (and indexers, for kind 3) and nobody's inbox. A caller that wants a report seen by a moderation relay adds that relay itself.
- A route can be larger than before for every other kind, including kinds 1 to 9802 with a recipient who lists more than three read relays.
- A kind NIP-51 adds later with `p` items fans out until it joins the list, with its name and its corpus vector, in one change.
- Do not reintroduce a fan-out kind set or a default cap: either quietly stops delivering events to people they mention. Do not widen the exclusion to a kind whose `p` tags are mentions (an article, a comment, a zap request): only kinds a NIP defines as lists or reports of people are excluded.
- Shared decision: nostr-adrs ADR-0042.
