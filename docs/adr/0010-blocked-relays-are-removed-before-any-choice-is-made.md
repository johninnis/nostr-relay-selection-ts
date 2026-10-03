# 10. Blocked relays are removed before any choice is made

## Status

Accepted

## Context

The blocklist used to be subtracted from each route's final output. Every decision taken before that point was therefore made as if blocked relays were usable:

- The per-recipient cap was taken before deduplication and before blocking, so a recipient listing `wss://b1` and `wss://b1/` spent two of three cap slots on one relay, and a recipient whose first three inbox relays were blocked contributed nothing, even with a fourth available.
- The `p`-tag relay hint is a fallback for a recipient with no inbox, but a recipient whose every inbox relay was blocked still "had" an inbox, so the hint never fired; and a blocked hint was never checked.
- A draft whose every private relay was blocked produced an empty route instead of the author's outbox, because the fallback checked the list before blocking.
- A group message whose group relays were all blocked produced an empty group route instead of falling through.
- A negative cap took from the wrong end, and a zero cap disabled fan-out (see the counts record).

## Decision

A blocked relay is treated as if no list ever contained it. The blocklist is applied before every decision that depends on whether a set is empty or how large it is:

- Per recipient: deduplicate the inbox, remove blocked relays, then take the cap when the caller sets one (by default every inbox relay is taken; ADR-0018). The `p`-tag hint is used when that inbox is empty, and only if the hint itself is not blocked. That use is a best-effort delivery fallback, the only relay the event names for the recipient; the hint itself says where the recipient's events are found, not where they read (ADR-0020).
- Drafts: `privateContentRelays` minus blocked relays; when that is empty, the author's outbox.
- Groups: the group relays minus blocked relays; when that is empty, the event falls through to its kind's normal branch.
- DMs: recipients' DM relays minus blocked relays; when that is empty, the route is refused.
- Reads about tagged users: each `#p`-tagged user's inbox minus blocked relays; a tagged user left with none brings in the user's own relays (ADR-0019).
- Author reads: an author whose outbox is empty after blocking is read from the fallback relays; a fallback route that is empty after blocking is omitted.

The relay directory applies this uniformly, because every relay set it returns is already blocked-free.

## Consequences

- Blocking a relay can change which branch applies, not only which relays a route lists. That is the intent: a blocked relay must not decide anything.
- The recipients reported as having no inbox (`recipientsWithoutInbox`, `RecipientsWithoutInboxFinder`) are exactly those this rule sends to the `p`-tag hint: no kind 10002, a list with no read entries, or every inbox relay blocked. A recipient whose list exists but yields no inbox counts as having none.
- "Simplifying" routing back to one subtraction at the end reintroduces every bug listed above. The corpus pins each case.
- Shared decision: nostr-adrs ADR-0044.
