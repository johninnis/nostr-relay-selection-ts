# 11. Private branches take precedence over NIP-29 group routing

## Status

Accepted

## Context

NIP-29 groups live on the relay that hosts them, and an event carrying an `h` tag belongs to a group. Routing such an event to its group relays, with no outbox or inbox fan-out, is correct for a group message.

The group check used to run first, before the DM and draft checks. An `h`-tagged kind 30024 draft, private content by definition, was therefore published to the public group relay instead of the caller's private relays, and an `h`-tagged gift wrap went to the group relay instead of the recipient's DM relays.

A group event can be left with no group relay: every relay its `h` tags' hint and the caller's `groupRelays` name may be blocked, and an event that carries no relay hint has none when the caller has not resolved the group's relay, as several clients never write a hint. Letting such an event fall through to its kind's normal branch sends it to its author's public outbox and to the inbox of every user it tags, so a closed group's chat lands on the relays the group exists to keep it off. An event's membership of a group is a property of the event, not of the relays a caller holds or blocks.

Reading the first `h` tag with a non-empty group id lets tag order decide both the event's group and its relay hint: an event whose `h` tags disagree is routed by whichever comes first, and a first tag with no hint hides the hint a later one carries.

Kind 30403 holds drafts but is not private. NIP-99 says "kind:30403 has the same structure as kind:30402 and is used to save draft or inactive classified listings": a public listing in a draft or inactive state, which readers fetch from its author's outbox like an active one. Sending it only to private relays hides it from those readers.

## Decision

Publish branches are tried in this order: DM (kinds 1059 and 21059), draft, group, then general. Both ports implement the group branch.

- The draft kinds are 30024 (NIP-23 draft article) and 31234 (NIP-37 draft wrap). Kind 30403 takes the route its tags give it, like any public event: the general branch, or the group branch when an `h` tag names its group.
- An event takes the group branch when it carries an `h` tag with a non-empty group id. The tags decide the branch, never the relays: the route's relays are the `h` tags' relay hint and the caller's `groupRelays`, less blocked relays (ADR-0010), and when none remains the route is the group branch with no relays. A group event never falls through to the general branch.
- The `h` tag is single-valued, and its occurrences are read as one claim, without regard to order:
  - `h` tags naming the same group id are one claim, whatever relay hints they carry. An `h` tag with no group id, or an empty one, takes no part.
  - `h` tags naming different group ids name no group. The event still belongs to some group, so it takes the group branch with no relays: neither a hint nor `groupRelays`, the relays of the one group the caller resolved, applies to it.
  - The hint is the one relay that every tag carrying a relay URL as its third element names, compared in canonical form. Hints that disagree are no hint, and the route then has the caller's `groupRelays` alone. A tag with no third element, or with one that is not a relay URL, takes no part.
- The `h` tags are read in one place, `groupClaimOf` in TypeScript and `GroupClaimExtractor::fromEvent` in PHP, which answers whether the event is a group event, whether its tags name one group, and their hint. `routePublish` and `PublishRouter::route` take the group branch on that answer. The reader carries a one-line fence pointing at this record where it reads every `h` tag as one claim, and the router where it takes the group branch whatever the relays.

## Consequences

- A private event never reaches a group relay through this library, whatever tags it carries. A caller that genuinely wants a draft stored on a group relay puts that relay in `privateContentRelays`.
- A group event is never published on a public route, whatever its group relays and the caller's blocklist. A group route with no relays is the caller's decision, as any empty route is (ADR-0012): resolve the group's relay, or do not publish.
- A group event never reaches the inbox fan-out, so `recipientsWithoutInbox` / `RecipientsWithoutInboxFinder` report none of its recipients. They tell a group event by the same reader the group branch uses, one function shared by both (`groupClaimOf` in TypeScript, `GroupClaimExtractor::fromEvent` in PHP), so the two cannot drift.
- A kind 30403 listing reaches its author's outbox and the inboxes of the users it tags, like the active listing it stands for, and `recipientsWithoutInbox` / `RecipientsWithoutInboxFinder` report its recipients unless an `h` tag names its group. The kind is not named (ADR-0014).
- Tag order never decides an event's group or its hint. Do not restore a read of the first `h` tag, and do not send an event whose `h` tags disagree on a public route because it names no group.
- The corpus pins each case in `route-publish.json`.
- An earlier version of this record counted kind 30403 among the draft kinds, took the group branch only while some group relay remained after blocking, so an event with none fell through to its kind's normal branch, and read the first `h` tag with a non-empty group id, so tag order decided an event's group and its hint.
- Shared decision: nostr-adrs ADR-0045 (the precedence, kind 30403 and the group route with no relays), ADR-0014 and ADR-0101 (the `h` tag read as one claim, its hint in canonical form).
