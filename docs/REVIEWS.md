# Independent implementation review loop

Scores are estimates by three AI reviewers, not official judge scores, user research, or release approval. Criteria are equal-weight 1–5: technology, design, potential impact, and idea. Reviewers inspect actual code/evidence and distinguish mocks, real inference, and external limitations.

Stability rule: two consecutive round-to-round changes below 0.1/5 in the panel mean, with no unresolved critical implementation defect. Stable scores do not close missing hardware, quota, human-evaluation, or submission gates.

## Round 1 — `543a82a`

| Reviewer    | Technology | Design | Impact | Idea |     Mean |
| ----------- | ---------: | -----: | -----: | ---: | -------: |
| Technical   |        2.5 |    3.5 |    2.0 |  4.0 |     3.00 |
| Product     |        3.0 |    3.5 |    2.5 |  4.0 |     3.25 |
| Competition |        3.0 |    4.0 |    2.0 |  4.0 |     3.25 |
| Panel       |       2.83 |   3.67 |   2.17 | 4.00 | **3.17** |

Findings and changes prepared for round 2:

- P1: deleted profiles could be restored by late import completion. Added operation invalidation and an explicit delayed-adapter UI regression test.
- P2: corrected categories contradicted original rule observations. Update rule findings with corrected categories while retaining local model observations.
- P2: failed cloud attempts were called skipped. Distinguish never attempted from unavailable after an approved attempt, preserving receipts.
- P2: invalid phone strings could match. Require usable digit lengths before comparison.
- P2: profile counts overstated the bounded sample and could exceed schema limits. Share a 40-message input selector and report the actual count.
- P2: negated payment/secrecy cues and mixed urgency were mishandled. Add conservative clause handling and independently supplied regression cases. Retain baseline results and label reruns exploratory.
- P2: mobile companion copy was squeezed; dialogs lacked accessible names. Stack the mobile card and label native dialogs.
- Evidence: add a separate 12-case synthetic paired pilot, split-integrity checks, per-case rule outputs, source hashes, hosted build metadata, separate headed/headless capability records, and stricter eventual live-success assertions.

All reviewers withheld credit for successful hybrid inference, demonstrated personal-context advantage, and real user outcomes. Those remain evidence gates until measured.

## Round 2 — `076af06`

| Reviewer    | Technology | Design | Impact | Idea |       Mean |
| ----------- | ---------: | -----: | -----: | ---: | ---------: |
| Technical   |       2.75 |   3.75 |   2.00 | 4.00 |     3.1250 |
| Product     |       3.00 |   4.00 |   2.50 | 4.00 |     3.3750 |
| Competition |       3.25 |   4.00 |   2.00 | 4.00 |     3.3125 |
| Panel       |       3.00 |   3.92 |   2.17 | 4.00 | **3.2708** |

The panel change is +0.1042, above the stability threshold. All prior implementation findings, including the P1 deletion race, were confirmed resolved. One new P2 issue: provenance made Git mandatory for source-archive builds. The next revision tolerates unavailable Git metadata, retains source hashes, and tests that behavior. Evidence improvements additionally freeze the pilot flag/abstention mapping and hash the evidence runner and build configuration. No model efficacy or user-impact score is increased based on these preparations.

## Round 3 — `a2fbd23`

| Reviewer | Technology | Design | Impact | Idea | Mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| Technical | 3.75 | 4.00 | 2.00 | 3.75 | 3.3750 |
| Product | 4.00 | 4.00 | 2.50 | 3.50 | 3.5000 |
| Competition | 4.00 | 4.00 | 2.25 | 3.75 | 3.5000 |
| Panel | 3.92 | 4.00 | 2.25 | 3.67 | **3.4583** |

Change: +0.1875; stability has not been reached. Technical attribution verification was provisional pending a hosted rerun. Reviewers gave credit for actual same-page hybrid execution, offline local inference, reviewed profile storage, and45 passing unit tests, while withholding effectiveness credit.

Resolved during this round: malformed local JSON constrained through SDK response schemas; profile output reviewed/edited before persistence; silent cloud truncation rejected; bounded cloud waiting; local sessions cancelled after every result/failure; cold-start allowance measured; P1 local-first App Check caching fixed using separate named Firebase app instances and sequencing-aware tests. The complete real hybrid flow then passed.

The real pilot failed to establish useful personal-context benefit. Product claims were explicitly narrowed, and impact/idea scores reflect that finding. Earlier timeouts and HTTP401 failures remain in evidence. No human outcomes or exact Nano4 eligibility were inferred.

Round4 corrections: record LIVE_HYBRID in reproducible provenance; report abstentions/errors by actual class and unflagged imposters explicitly; refresh screenshots after asserting a visible provider search chip. These changes improve evidence clarity without manufacturing additional model efficacy.

Hosted verification additionally exposed a P1 update-cache defect: the persistent browser executed an older script despite fresh server build-info. Default one-hour HTML caching contaminated service-worker precaching. Round4 now fixes HTML revalidation and worker fetch policies, checks the executing script paths, and retests upgrade plus offline reload using the existing profile. See evidence/stale-client.json; those failures must not be attributed to the current local model code.
