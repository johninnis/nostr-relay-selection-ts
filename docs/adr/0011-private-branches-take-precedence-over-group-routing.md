# 11. Private branches take precedence over NIP-29 group routing

## Status

Accepted

## Context

NIP-29 groups live on the relay that hosts them, and an event carrying an `h` tag belongs to a group. Routing such an event to its group relays, with no outbox or inbox fan-out, is correct for a group message.

The group check used to run first, before the DM and draft checks. An `h`-tagged kind 30024 draft, private content by definition, was therefore published to the public group relay instead of the caller's private relays, and an `h`-tagged gift wrap went to the group relay instead of the recipient's DM relays. The PHP port had no group branch at all, so its corpus copy had silently dropped the three group vectors.

## Decision

Publish branches are tried in this order: DM (kinds 1059 and 21059), draft (kinds 30024, 30403, 31234), group (an `h` tag with a non-empty group id whose relays, from the tag's relay hint and the caller's `groupRelays`, are not all blocked), then general. Both ports implement the group branch.

## Consequences

- A private event never reaches a group relay through this library, whatever tags it carries.
- A caller that genuinely wants a draft stored on a group relay puts that relay in `privateContentRelays`.
- Shared decision: nostr-adrs ADR-0045.
