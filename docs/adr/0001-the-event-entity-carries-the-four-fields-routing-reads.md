# 1. The Event entity carries the four fields routing reads

## Status

Superseded by ADR-0004

## Context

`Event` takes four constructor arguments — kind, pubkey, created_at and tags. Four is past the point where an argument list is treated as evidence that a unit has taken on more than one job, so the analyser reports it and a reader arrives expecting either a decomposition into collaborators or a parameter object.

Neither applies. The four are not collaborators a unit orchestrates; they are the fields of a protocol record, fixed by NIP-01 rather than chosen here. There is no smaller unit inside `Event` waiting to be named: a kind without a pubkey, or tags without the event they hang off, are not concepts this library has any use for. A parameter object would be worse than the count it removes — the only honest name for a bundle of all four is "the event", so the result is this class with an extra layer in front of it.

The count is also already the minimum. This is a deliberately reduced copy of the full protocol event: there is no id, no content and no signature, because relay routing never reads them. Every field that remains is one the routing decisions consume.

## Decision

`Event` keeps its four constructor arguments, and the constructor carries a one-line fence pointing at this record.

The exemption is for a data-shaped type whose fields are set by an external format. It is not a general licence for a four-argument constructor: a unit that orchestrates four collaborators is still hiding a responsibility and still decomposes, and a class whose fields merely happen to travel together is still a value object waiting to be extracted.

## Consequences

- The entity mirrors the wire record it is parsed from, so a reader comparing it against NIP-01 sees the same fields in the same shape.
- Adding a fifth field is a signal worth stopping on. It would mean routing has started reading part of the protocol event this type was scoped to exclude, and the question to answer first is whether that reading belongs in relay selection at all.
- Do not introduce a parameter object to lower the count; there is no concept behind the bundle other than the event itself.
