# 16. A relay's NIP-65 marker is read across every `r` tag naming it, and an undefined marker is both

## Status

Accepted

## Context

NIP-65 gives an `r` tag an optional `read` or `write` marker, and says an omitted marker means both. It says nothing of any other marker, nor of one relay named by more than one `r` tag.

Both ports read an `r` tag's marker against `read`, `write` and `both` only, so a relay marked `readwrite`, or with any other value, was neither an inbox nor an outbox and was dropped: a relay the author listed went unused, and a reader built on nostr-core saw it where this library did not.

## Decision

The inbox and outbox roles read kind 10002 `r` tags as the shared record decides:

- A `read` marker makes a relay an inbox, a `write` marker an outbox. An absent marker, and any marker NIP-65 does not define (`both` and `readwrite` among them), makes it both. A relay is never dropped for its marker.
- A relay named by several `r` tags is the union of them, tags compared by canonical relay URL: an inbox if any of them reads, an outbox if any of them writes. Tag order never decides it.
- In TypeScript the rule lives in `extractRelays` (`src/relay-role.ts`); in PHP in `RelayRole::extract`. Each role keeps every `r` tag except one marked with the other direction, and the relay set collapses duplicates by canonical URL, which is the union.

## Consequences

- This library and nostr-core read every relay list as the same relays used the same ways.
- The corpus pins it: `extract-relay-urls.json` holds an undefined-marker vector and a `read` plus `write` pair naming one relay in two spellings, for each role.
- Do not drop a relay for a marker NIP-65 does not define, and do not read a relay's marker from one of its tags.
- Shared decision: nostr-adrs ADR-0108.
