# 20. A relay hint names where its target is found, and prefers the relay it was seen on

## Status

Accepted

## Context

Relay hint selection took the user and a target pubkey, and answered every tag the same way: the first of the user's outbox relays in the target's inbox, else the target's first inbox relay, else the user's first outbox relay. That answer is wrong for an `e`, `q` or `a` tag, which stands for an event. NIP-10 and NIP-18 define the relay in those tags as a relay where the referenced event can be found. NIP-65 says authors publish to their write relays and that others fetch a user's events there, so the event is on its author's outbox, not on the author's inbox. And a relay the caller actually received the event from is a stronger hint than any relay list, which only says where the author meant to publish.

It is just as wrong for a `p` tag. NIP-02 defines the relay in a `p` tag as "a relay URL where events from that key can be found", and NIP-19 gives an `nprofile`'s relay as one where the profile "is more likely to be found"; welshman writes a `p` hint from the tagged user's outbox. The inbox reading came from publish routing, which sends to a `p` hint when the recipient has no relay list (ADR-0018). That is a best-effort delivery fallback that uses the only relay the event names for the user; it is not what the hint means, and a hint chosen for it named a relay where the user's events need not be.

## Decision

The function takes the user, a target naming whose events the hint should find, and the directory. The target carries that pubkey and, optionally, a relay the caller received the target from:

- TypeScript: `selectRelayHint(userPubkey, target, directory)`, `target` a `RelayHintTarget`: `{ pubkey, seenOn? }`.
- PHP: `RelayHintSelector::select($userPubkey, $target, $directory)`, `$target` a `RelayHintTarget`: `new RelayHintTarget($pubkey, $seenOn = null)`.

`pubkey` is the referenced event's author for an `e`, `q` or `a` tag, and the tagged user for a `p` tag. `seenOn` is a relay the caller received the target from: the referenced event itself, or an event by the tagged user. The target is one argument rather than a pubkey and a relay beside it, so the function keeps three parameters and the relay cannot be mistaken for anything but where the target was seen.

Every hint names where its target's events are found. With blocked relays removed first (ADR-0010), the hint is the first of:

1. `seenOn`, when given and not blocked.
2. The target's first outbox relay.
3. The user's first inbox relay, as a last resort.

It is `null` when no candidate remains. `seenOn` is a `RelayUrl`, so it is normalised and valid by construction (ADR-0005); a caller with a raw string constructs it and passes nothing when that fails.

The target names no tag kind. An earlier shape did, as a discriminated union in TypeScript (`{ reference: "event", author, seenOn? } | { reference: "pubkey", pubkey }`) and a `RelayHintReference` enum behind named constructors in PHP, while an event hint and a `p` hint were chosen by different rules. Once both name where the target's events are found, the reference changed nothing but whether `seenOn` could be passed, and that restriction was wrong: NIP-02 defines a `p` relay as one "where events from that key can be found", and a relay the caller received one of the user's events from is exactly that, the same evidence a seen-on relay is for an event. A discriminant that selects no behaviour is a second way to say the same thing, and in PHP the enum's only reader was the test corpus.

## Consequences

- A reader following an `e`, `q` or `a` hint reaches a relay that holds the event, and one following a `p` hint, or an `nprofile` built from it, reaches a relay that holds the user's events.
- A caller passes the pubkey whose events the hint should find; a call that names a reference kind, or a target with no pubkey, no longer compiles or runs.
- Do not reintroduce a per-tag reference unless the two hints come to be chosen by different rules. Do not choose a hint from the target's inbox, and do not let a seen-on relay override the blocklist.
- Shared decision: nostr-adrs ADR-0110.
