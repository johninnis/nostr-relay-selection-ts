# 19. A read about tagged users goes to their inbox relays

## Status

Accepted

## Context

NIP-65 says that when downloading events about a user, where the user was tagged, clients SHOULD use that user's read relays. A filter with a `#p` asks exactly that. The general read branch used to ignore the filter's subject and read the querying user's own inbox and outbox, so a query for replies to, or mentions of, another user went to relays that user never named, and missed events that NIP-65 publishers had sent to that user's inbox.

## Decision

On the general read branch (no search, not the DM-inbox pattern), the route is the union, in this order and with blocked relays removed first:

1. The kind 10002 inbox relays of every user named in a `#p` of any filter, in first-seen order across the filters.
2. The user's own kind 10002 inbox, then outbox, but only when NIP-65 names nothing better: when no filter has a `#p`, when any filter in the set has none, or when a tagged user has no inbox left after blocking.
3. `callerRelays`, always, because the query itself names them.

The user's own relays stay out of a read that every tagged user's inbox already covers. The choice follows what an experienced client author would make: NIP-65's read relays are where publishers following NIP-65 send events about a user, so they are the authoritative source; the user's own relays add nothing for another user's mentions and only cost connections. They come back the moment the rule cannot be applied, so a read never routes to fewer relays than before for a user whose relay list is unknown or blocked. A filter set gets one route, so a set mixing a `#p` filter with one that has none reads both sets of relays.

No per-user cap applies: a read is one subscription per relay, and a caller with a large `#p` set splits it before routing.

The DM-inbox branch is unchanged: a filter set asking only for gift wraps addressed to one recipient reads that recipient's kind 10050 relays, or is refused. The search branch is unchanged.

## Consequences

- A notification query (`#p` naming the user) reads the user's inbox, which is where NIP-65 publishers deliver it, and no longer adds the user's outbox.
- A query for another user's mentions reads that user's inbox and does not depend on the querying user's relays.
- Do not drop the fallback to the user's own relays for an untagged filter or a tagged user with no inbox: the read would route to nothing.
- Shared decision: nostr-adrs ADR-0042.
