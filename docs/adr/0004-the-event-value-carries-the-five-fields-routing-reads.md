# 4. The event value carries the five fields routing reads

## Status

Accepted

## Context

The event this library reads is a deliberately reduced copy of the full protocol event: id, kind, pubkey, created_at and tags. There is no content and no signature, because routing never reads them.

The id was once excluded too. It is needed because relay lists are replaceable events, and routing must pick the newest list per (pubkey, kind). NIP-01 settles a `created_at` tie by keeping the event with the lowest id. Without the id the library could only keep whichever list it saw first, which makes the answer depend on the order of the caller's array: two callers holding the same events could route differently. This record supersedes ADR-0001, which scoped the event to four fields and excluded the id. It restates the whole decision.

In PHP the event is a value object with a five-argument constructor. Five is past the point where an argument list is treated as evidence that a unit has taken on more than one job, so a reader arrives expecting either a decomposition into collaborators or a parameter object. Neither applies. The five are not collaborators a unit orchestrates; they are the fields of a protocol record, fixed by NIP-01. A parameter object would be worse than the count it removes: the only honest name for a bundle of all five is "the event".

## Decision

The event carries id, kind, pubkey, created_at and tags, and nothing else. The id is read only to break a `created_at` tie between relay lists, lowest id first, as NIP-01 specifies. It is validated as 64 lowercase hex characters and never verified against the event's content, because verification needs the content and a hash, both out of scope for routing.

- In TypeScript, `Event` is a readonly object type whose five fields are all required, `id` typed as the library's `EventId`. `createEvent` validates all five from untrusted JSON and returns `null` when any is missing or malformed.
- In PHP, `Event` is a value object whose constructor takes the five fields and carries a one-line fence pointing at this record. `Event::tryFromRaw` validates all five and returns `null` when any is missing or malformed. The exemption is for a data-shaped type whose fields are set by an external format; it is not a general licence for a five-argument constructor.

## Consequences

- The type mirrors the wire record, so a reader comparing it with NIP-01 sees the same fields under the same names.
- Every event handed to the library must carry an id. Events from any relay or signer already do; hand-built test fixtures need one.
- Adding a sixth field is a signal worth stopping on: it would mean routing has started reading part of the protocol event this type was scoped to exclude, and the first question is whether that reading belongs in relay selection at all.
- Do not introduce a parameter object to lower the count, and do not drop the id to shorten the type: the tie-break needs it.
