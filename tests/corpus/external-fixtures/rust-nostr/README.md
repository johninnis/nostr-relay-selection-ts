# rust-nostr external fixtures

Signed Nostr events lifted verbatim from
[`rust-nostr/nostr`](https://github.com/rust-nostr/nostr)'s gossip test
suite for use as cross-implementation evidence in this library's
corpus.

Each fixture file carries a `source` field naming the exact upstream
test (file + test-function) the event came from. The events themselves
are unmodified — only the surrounding test expectations differ between
rust-nostr's policy and ours.

Why import them at all? When two independent implementations consume
the same signed input event and produce different policy outputs, the
divergence is interesting on its own. Sharing fixture inputs makes
the divergence inspectable.

## Files

| File | Upstream source |
| --- | --- |
| `kind-10002-nip65-relay-list.json` | `gossip/nostr-gossip-test-suite/src/lib.rs::gossip_unit_tests::test_process_nip65_relay_list` |
| `kind-10050-nip17-inbox-relays.json` | `gossip/nostr-gossip-test-suite/src/lib.rs::gossip_unit_tests::test_process_nip17_inbox_relays` |
| `kind-10002-allowed-relays-mixed.json` | `gossip/nostr-gossip-test-suite/src/lib.rs::gossip_unit_tests::test_selection_with_allowed_relays` |

Note that the third event uses a placeholder signature
(`f5bc6c18...4ce0304`) in the upstream test — rust-nostr does not
verify signatures in its test suite. Our compliance tests likewise do
not verify signatures (out of scope for relay-selection). The first
two events have what appear to be real signatures against their
upstream test-key pubkey.

These fixtures are consumed by vectors in
`tests/corpus/classify-url.json` and other corpus files; cross-refs
are tagged with the upstream test name in each consuming vector's
`source` field.
