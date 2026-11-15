# Hakiki sprint build plan

Planning baseline: November 15, 2026. Ship a complete Chrome experience with a demonstrable privacy boundary and measured personal-context value for #BuildHybridAI 2026.

This plan assumes one primary developer and approximately 75 focused hours, with five hours of contingency across November 15–30. Estimates exclude optional iPhone work and participant availability. The owner confirms available hours at kickoff; if capacity is lower, cut optional scope before reducing safety checks or fabricating evidence. Dates and submission targets use America/New_York.

The working product, public source, license, text description, and public demonstration video must be ready by **November 30 at noon**, leaving five hours before the official **5:00 PM** deadline. Freeze features on November 26. Continue to fix release-blocking defects afterward.

## Sprint schedule

| Sprint | Dates | Budget | Deliverable | Exit decision |
| --- | --- | --- | --- | --- |
| 0 — Feasibility | Nov 15–16 | 12 h | Verified SDK path, privacy contract draft, personal-context experiment | Continue, narrow language, or revise the premise |
| 1 — Core flow | Nov 17–19 | 16 h | Real text-to-card Chrome flow with optional local profile | A fresh user can complete a check |
| 2 — Privacy and resilience | Nov 20–23 | 20 h | Enforced outbound contract, receipt, failure states, hosted candidate | No prohibited content on tested outbound paths |
| 3 — Evidence and polish | Nov 24–26 | 15 h | Frozen comparative evaluation and five walkthroughs | Claims match measured evidence; feature freeze |
| 4 — Release | Nov 27–30 | 12 h | Reproducible release, demo, Devpost materials | Submission complete before the deadline |

Every sprint ends with a brief working demonstration and a written gate result. A checkbox is complete only when its acceptance evidence exists. Documentation setup does not count as a working application.

## Sprint 0 — Feasibility

**Goal:** test the two assumptions that could invalidate the build before investing in the full interface.

| Task | Hours | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| S0-1 Verify environment and SDK | 3 | None | Exact package/version, Chrome/OS/hardware requirements, local capability probe, runtime local call, cloud call, App Check setup, and execution-location evidence recorded |
| S0-2 Test personal-context signal | 4 | S0-1, S0-3 | Twenty development cases run through local, cloud, and rules paths; wrong/omitted profile comparison; counts and failure examples recorded |
| S0-3 Validate feature contract and grounding | 3 | S0-1 | Closed feature schema tested on diverse requests; cloud can provide useful generic evidence; grounding and required attribution verified; no raw content sent |
| S0-4 Lock scope and recruit testing participants | 2 | S0-2, S0-3 | Language scope, target-user assumptions, device access, owner availability, and five potential walkthrough slots recorded privately |

Check SDK imports, inference preference behavior, JSON support, image support, grounding, quotas, and cost against current official docs and the installed runtime. Do not copy the old PRD's model version, token limit, browser version, or iOS support claims into implementation without verification. Test separate strict-local and cloud instances on the same page. A local-only failure must not generate a cloud request.

Use [the evaluation protocol](EVALUATION.md) for the 20-case gate. Start with the original 8/10 detection and at most 2/10 false-alarm screen, then inspect personal-context benefit. If the gate fails, spend at most one additional development day narrowing language or simplifying profile features, taken from optional scope. If useful context still cannot be demonstrated, revise the premise explicitly; extraction-only behavior is not evidence that style-based verification works.

**Exit:** verified local and cloud execution, an enforceable proposed cloud schema, and an explicit continue/narrow/revise decision. If capable Chrome hardware is unavailable, record the dependency immediately; a cloud-only demo cannot masquerade as the planned hybrid product.

## Sprint 1 — Core flow

**Goal:** one complete request check that works before optional import or advanced input.

| Task | Hours | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| S1-1 Bootstrap web app and repeatable checks | 3 | S0 exit | TypeScript app runs from README commands; pinned lockfile; lint/typecheck/build and meaningful boundary tests in CI |
| S1-2 Build first-use and synthetic example flow | 3 | S1-1 | Paste/select example, preview, check, reset; keyboard accessible; no mandatory export or named account |
| S1-3 Add local profile import and comparison | 5 | S1-1, S0-2 | Supported WhatsApp text-export format documented; local parsing/profile; sparse/malformed history states; delete controls; absent sender metadata stays unknown |
| S1-4 Connect actual cloud evidence and card | 5 | S1-2, S1-3, S0-3 | Strict-local comparison, approved feature request, validated cloud result, local card rendering, trusted-route action, visible uncertainty |

The card uses deterministic localized templates in the baseline. Removing the separate model-written card reduces latency and closes an unnecessary fallback path. Offer a generic check when the user has no history. A synthetic demonstration contact is clearly marked fictional and is never silently treated as the user's own family.

**Exit:** demonstrate a genuine urgent request, an imposter request, and a no-history check end to end. The cloud path must use real Firebase AI Logic, and the local path must be visibly distinguishable from a mock.

## Sprint 2 — Privacy and resilience

**Goal:** make the full flow trustworthy under ordinary failures and adversarial input.

| Task | Hours | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| S2-1 Enforce schema and capture request receipts | 5 | S1-4 | One guarded cloud adapter; extra fields and arbitrary strings rejected; failed sends represented; receipt matches serialized application AI payload |
| S2-2 Implement all degraded states | 5 | S2-1 | No model, offline with/without model, timeout, malformed output, unsupported language, missing metadata, disagreement, retry, and deletion tests pass |
| S2-3 Audit network and injection boundaries | 5 | S2-1, S2-2 | Canary data and malicious prompts produce zero prohibited-content transmissions; independent capture confirms receipt coverage; logging and storage reviewed |
| S2-4 Configure delivery services and judge access | 3 | S1-1, S2-3 | App Check enabled; Remote Config bundled defaults and version handling; hosted candidate; no debug secrets committed; no-local-model browser can use the fallback |
| S2-5 Reserve for capability failure or screenshot spike | 2 | S2-3, S2-4 | Use first for critical defects; only if clear, test local screenshot input and decide whether it fits remaining capacity |

Use the [privacy contract](PRIVACY.md) as the acceptance source. Do not claim an SDK execution-location flag proves all network content. Include infrastructure traffic in the audit and describe what the receipt covers.

**Exit:** a hosted Chrome candidate with zero prohibited-content transmissions across the defined suite and a usable fallback. A privacy failure blocks cloud release regardless of other progress. If screenshot support is unfinished, remove the control and ship text input.

## Sprint 3 — Evidence and polish

**Goal:** establish what the product actually helps with and fix misleading interactions.

| Task | Hours | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| S3-1 Freeze benchmark and evaluation settings | 4 | S0-2; can prepare earlier | Target 80 balanced cases with documented provenance, disjoint contacts/templates, fixed labels, and no profile/test contamination |
| S3-2 Run comparative evaluation | 4 | S2 exit, S3-1 | Rules, local, cloud, hybrid, and profile-ablation results; confusion counts, abstentions, per-language breakdown, latency, and failure examples |
| S3-3 Observe five user walkthroughs | 4 | S2 exit, S0-4 | Completion time, help needed, uncertainty comprehension, and verification-route choice recorded; public report contains no participant identities |
| S3-4 Fix comprehension and access problems | 3 | S3-2, S3-3 | Confusing reassurance removed; keyboard/focus/contrast checked; claims and supported-language list updated; features frozen |

User sessions may occur earlier when participants are available. Begin collecting and reviewing benchmark cases during Sprint 1 to avoid a last-day data scramble. Keep development tuning separate from the held-out final run.

**Exit:** all measured results, including misses and false alarms, are reproducible and the pitch matches them. Missed targets trigger narrower claims or an explicit pivot, not selective reporting. If user recruitment fails, document that limitation and stop claiming observed usability benefits.

## Sprint 4 — Release

**Goal:** make the project easy to judge, reproduce, and submit.

| Task | Hours | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| S4-1 Stabilize and rehearse a clean setup | 4 | S3 exit | Fresh checkout installs and builds; critical state tests pass; actual device/browser matrix recorded; hosted app agrees with release commit |
| S4-2 Record demonstration | 3 | S4-1 | Public YouTube video at most three minutes, English narration or subtitles, actual app footage, each claimed platform shown |
| S4-3 Finish repository and Devpost copy | 3 | S4-1, S3-2 | Value proposition, architecture, environment setup, measured results/limits, sources, license, runtime SDK call locations, hosted URL, and platform selection reviewed |
| S4-4 Submit and verify | 2 | S4-2, S4-3 | Submit by Nov 30 noon; verify public links and receipt; preserve release SHA and final assets |

Submission is an owner action unless separately authorized at release time. This build-plan task does not register for or submit to the hackathon, publish a video, or provision billable infrastructure.

Suggested video sequence: 0:00–0:20 audience and request; 0:20–1:10 real hybrid check; 1:10–1:35 privacy preview and receipt; 1:35–2:00 no-model/offline behavior; 2:00–2:35 comparative results and limitations; 2:35–3:00 verification action and close. If iPhone ships, rebalance the sequence to show it within the same three-minute limit.

## Conditional iPhone branch

Decide no later than November 23. Start only if the Chrome Sprint 2 gate passes, a Mac/Xcode and compatible iPhone are available, the current iOS hybrid SDK is verified, and at least 12–18 additional focused hours or a second developer are available. These hours are outside the 75-hour baseline.

Reuse schema definitions, synthetic fixtures, prompts, card wording, and evaluation cases. Implement native text checking first; add local OCR only after text and privacy tests pass. Demonstrate strict local execution, cloud evidence, no-model fallback where applicable, and matching receipts. Stop by the November 26 freeze if parity is incomplete; do not select iOS in the submission unless it works and appears in the video.

## Critical path and scope cuts

Critical path: S0 SDK and personal-context gates → S1 real text flow → S2 outbound boundary and fallback → S3 honest comparative evidence → S4 reproducible release and submission.

If behind, cut in this order: two-platform demo view, iPhone, screenshots, additional languages. Automated playbook refresh and Firestore collection are already out of scope. Keep a simple manually curated/versioned playbook rather than building an update service. Never cut the raw-data boundary, uncertainty states, independent verification action, or honest evaluation reporting.

## Ownership and tracking

The project owner is accountable for scope decisions, Firebase account access, hardware, participant recruitment, any personal story, and final submission. The implementer owns code, tests, documentation, and reproducibility. One person may fill both roles; add names when collaborators join.

Track one GitHub milestone and one checklist issue per sprint initially. Use task IDs from this plan in commits and later implementation issues. Only close a sprint after linking its gate evidence; creating a milestone does not mean the work has started. Keep private data and credentials out of issues.

## Definition of done

- Relevant acceptance criteria demonstrated on real target hardware; mock behavior explicitly labeled.
- Privacy/schema/state tests pass for changed paths; no tokens, personal messages, or raw fixtures in Git.
- Install/run instructions and actual SDK versions updated; lockfile committed when dependencies are installed.
- Public claims describe measured behavior and supported languages; failure and uncertainty states remain visible.
- Required Firebase calls execute at runtime, App Check is enabled, and the hosted release is traceable to a commit.

## Judging alignment

| Criterion | Evidence to produce | Primary sprint |
| --- | --- | --- |
| Technological Implementation | Real local/cloud SDK execution, enforced privacy boundary, meaningful tests, reproducible setup | 0, 2, 4 |
| Design | Complete first use, sparse-history/failure states, accessible card, understood verification action | 1, 2, 3 |
| Potential Impact | Balanced comparative results and observed target-user behavior | 3 |
| Quality of the Idea | Personal-context ablation showing what private context adds | 0, 3 |

The supplied official rules score these equally from 1–5 and break ties in the listed order. The plan favors technical completeness and evidence over counting SDK modes or platforms.

## Sources and open technical checks

- [Hackathon overview](https://firebasehybridaihackathon.devpost.com/): deadline, platform choices, runtime AI Logic use, App Check, and required submission materials; checked November 15, 2026.
- [Official rules](https://firebasehybridaihackathon.devpost.com/rules): supplied rules text reviewed for scoring and submission requirements.
- Supplied Hakiki PRD dated November 15, 2026: original product requirements and unresolved SDK assumptions.
- Three independent reviews in the planning conversation: mean proposed-solution score 3.25/5; recommendations incorporated above.

Use the hackathon Resources links to reach the current official Firebase platform guides during S0. The generic Firebase hybrid-inference documentation URL could not be retrieved during planning; this plan deliberately does not treat its SDK assertions as verified.
