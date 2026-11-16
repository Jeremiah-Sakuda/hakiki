# Confirmed arrangements evaluation, version 1

This is a declared product revision, not a relabeling of the failed writing-style pilot. The old pilot and its identity labels remain in EVALUATION.md. New hypothesis: an explicit, user-confirmed arrangement enables a supported observation and an appropriate independent check. A departure may be genuine; consistency cannot authenticate anyone.

## Frozen contract

The contract is the source hashes of `src/context.ts`, `src/interpretation.ts`, `src/domain.ts`, and `src/ai.ts` in the freeze record. Profiles contain optional writing context and separately confirmed arrangements. Unknown is the default; imports and models never populate arrangements. The confirmation date is displayed for review, with no assumed expiry or inferred current validity.

The on-device model extracts six editable categorical facts, each with an exact local evidence span. An unsupported span downgrades an assertion to unknown. A valid span establishes provenance only, not semantic correctness. Users review the interpretation. Context comparison is deterministic against that same interpretation; approved cloud requests contain only the categories, never the contact, agreements, quotes, history or personal observations.

## Independent synthetic set

An AI evaluation agent authors 48 English synthetic cases in 24 whole scenario families after implementation is frozen. Six strata: clear departures, consistent requests, genuine exceptions, copied-style imposters, missing/ambiguous context, and adversarial/conflicting content. Hidden authored identities are retained separately from observable evidence. Indistinguishable genuine/imposter pairs are controls, not cases an identity detector can solve. No recruited users or real conversations are represented.

No tuning on these cases before the first complete run. A revision after inspecting outcomes makes later use of this set exploratory. Any newly held-out claim requires another independent set and freeze. Errors remain in denominators.

## Measures

- Supported departure precision: correct asserted departure codes / all asserted departure codes.
- Departure recall: expected departure codes actually emitted / all expected departure codes, including inference failures.
- False departure cases: cases with an unexpected departure / cases expected to have no departures.
- Unknown handling: missing confirmed context produces no invented departures; ambiguous facts remain unknown. Report exact category accuracy separately.
- Action correctness and prohibited claims: two AI reviewers independently rate randomized outputs without variant labels or hidden identity. This is AI review, not human validation.
- Incremental context: count cases with correct personal observations beyond the generic rule warnings. Compare rules alone, rules plus confirmed context, and local extraction plus context. Generic rules do not produce agreement-specific codes; this is a capability comparison, not an identity-accuracy claim.

Predeclared engineering targets are at least 90% departure precision, 80% departure recall, at most 10% false-departure cases, and zero observed identity-certification, invented-personal-fact or raw-transmission violations. These are project targets on a small synthetic set, not population guarantees.

Omitted and wrong-profile comparisons reuse the same extracted facts to isolate the effect of changing saved context; they are not independent model runs. Wrong-profile output is judged against the profile actually supplied and never establishes identity. One cloud response for the first case in each stratum is shared between cloud-only and hybrid presentation; failures are preserved. Six cloud responses are an exploratory usefulness sample, not a validated cloud-quality benchmark.

## Reliability protocol

`scripts/check-reliability.mjs` runs three freshly launched browser sessions, eight fixed synthetic comparisons in each, one profile generation per block, deliberate cancellation followed by recovery, offline comparison and reconnect, plus local→cloud and cloud→local ordering when LIVE_HYBRID=1. Each request has a fresh native session and controller. Availability has a five-second deadline, setup a ten-minute cancellable limit, and inference a sixty-second limit. There are no automatic retries.

Preserve all first attempts, failure codes/stages, elapsed times, cancellations and incomplete runs. Report completion counts and median/p95 latency. A successful small run cannot demonstrate 99% reliability or explain an earlier uninstrumented failure. Redacted in-memory diagnostics contain only fixed categories and timings; no prompt, output, profile, token or exception text. The application lets the user explicitly retry and export these diagnostics locally.

## Review interpretation

Use the hackathon's four equally weighted criteria without directing reviewers toward the owner's desired score. Report independent scores and remaining evidence gaps. Human comprehension, prevented loss, broader language performance, exact Nano 4 eligibility and owner submission/video remain separate gates.
