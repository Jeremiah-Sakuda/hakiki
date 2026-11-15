# Hakiki product requirements

Updated November 15, 2026 from the supplied Hakiki PRD and three independent judging reviews. This version governs the build plan. All outcomes below are requirements or hypotheses until demonstrated.

## Product and audience

Hakiki helps a person pause and independently verify a family money request. Its proposed advantage is combining private relationship context with current scam intelligence without uploading conversation history.

The initial audience hypothesis is people in the Kenyan diaspora receiving family money requests in English or Swahili. Validate this with five target-user walkthroughs. English is the baseline interface language; Swahili support ships only after language-specific testing. Sheng and Pidgin are deferred. Broader audiences can follow after this workflow is established.

The product must never infer that a familiar writing style, a known number, or absence of a scam match proves identity. The main outcome is a useful verification action, not an authenticity score.

## Scope

P0 is a complete desktop Chrome text flow with synthetic judge examples, optional local contact history, a cloud request preview, an inspectable receipt, and explicit uncertainty. A real local and cloud path through Firebase AI Logic must be demonstrated for the hybrid entry. A mock interface or cloud-only implementation does not satisfy that release goal.

P1 includes screenshot input, validated Swahili output, and iPhone. Each requires the corresponding capability and quality gates. iPhone additionally requires a Mac/Xcode environment, a compatible physical device, and time to demonstrate the same privacy contract. None is allowed to displace baseline reliability or evaluation.

Excluded: Android, official notices, voice cloning detection, chat bots, transfers, identity certification, a community scam ledger, cloud storage of contact history, and automatic background submission of queued messages.

## User journey

1. Start with a synthetic example or paste a request. A first check does not require sign-in or a chat export unless the verified SDK configuration requires an invisible anonymous session.
2. Optionally choose a locally stored contact. Import a WhatsApp text export without media to add personal comparison. Explain what is stored and provide deletion. On devices without a local model, use the generic check; do not upload the export to create a profile.
3. If needed, provide a sender number separately and identify it as user-entered. Pasted text alone has no trustworthy sender metadata. A number match describes a comparison, not authenticated origin.
4. Preview the fixed cloud feature fields and explicitly choose to send. Names, message text, history, and personal findings are not among these fields. Users may choose a local-only result.
5. Read a card with the claim, requested action, personal-context observations, scam-pattern findings with sources where available, and a verification action. Claim and ask remain locally rendered.
6. Verify through a previously saved contact route, preferably a separate channel. A user-entered saved route is explicitly labeled; do not derive a trusted route from the suspicious message or cloud search. Hakiki never initiates a call or sends a message automatically.
7. Open a receipt of application AI request content and execution locations. Delete the check and, separately, any saved profile.

## Required product states

| State | Required behavior |
| --- | --- |
| Local model and sufficient history available | Compare locally; send only approved feature fields; combine evidence on device |
| No history or sparse history | Say personal comparison is unavailable; permit a generic check |
| Local model unavailable | Keep raw text local; offer deterministic or user-selected feature categories, preview, and approved cloud check |
| Sender number absent | Display unavailable; do not infer it from wording |
| Offline with local model | Return a partial local card; identify missing cloud evidence |
| Offline without local model | Give static independent-verification guidance; do not imply AI analysis occurred |
| Connection restored | Offer retry with fresh preview and consent; never automatically transmit a pending check |
| Local failure, invalid model output, or cloud timeout | Preserve useful partial findings and label unavailable evidence; no silent raw-text fallback |
| Witness disagreement | Show both observations and explain that identity remains unverified |
| No relevant grounded source | Say no matching source found; do not treat this as clearance |
| Unsupported language | Explain the limitation and permit manual verification; no untested language-quality claim |
| Screenshot unreadable or unsupported | Ask for pasted text; never upload the image as fallback |

Avoid green safety badges, identity probabilities, and a global safe/unsafe score. Use plain-language uncertainty and a persistent verification action. Provide keyboard access, readable contrast, meaningful focus states, and screen-reader labels.

## Requirements and priority changes

| Requirement | Priority | Acceptance |
| --- | --- | --- |
| Optional local profile import and deletion, original R1 | P0 | Export parsed and distilled on device; malformed exports explain recovery; no-model flow skips import |
| Pasted request and chosen contact, R2/R4 | P0 | Real local path produces validated observations with unknown states |
| Constrained outbound contract, replaces R5 | P0 | Only allowlisted categorical fields pass; invalid fields fail closed |
| Cloud intelligence, R6 | P0 | Real AI Logic call; grounding capability verified and sources displayed accurately |
| Card and privacy receipt, R7/R8 | P0 | Locally rendered card; request content matches what the adapter actually serialized |
| Missing-model flow, revises R9 | P0 | Preview and approval; no raw-text cloud fallback |
| App Check, R10 | P0 | Enabled; debug tokens confined to local development configuration |
| Anonymous Authentication, part of R10 | Conditional | Add only for a documented requirement; no named accounts or profile sync |
| Remote Config, narrowed R11 | P0 | Versioned prompts/playbook IDs with bundled defaults; cannot change the outbound schema |
| Synthetic examples, R12 | P0 | Clearly labeled; usable without private data |
| Offline partial card, promoted/revised R14 | P0 | Both offline states work; no background queue transmission |
| Chrome screenshot input, R3 | P1 | Local-only extraction verified; preview correction; unreadable-image fallback |
| iPhone, R13 | P1 | Same contract and state tests pass on physical hardware |
| Two-platform view, R15 | P1 | Only if both real implementations exist |
| Automated playbook refresh, R16 | Deferred | Use a bundled or manually curated version during the hackathon |
| Firestore pattern ledger, R17 | Deferred | No collection or cloud retention of user patterns in the baseline |

## Success and decisions

The hybrid hypothesis is that private context adds useful evidence under a fixed privacy boundary. It is not a claim that either model's removal makes every function stop working. Evaluate against rules, local-only, cloud-only, and combined baselines using the [evaluation protocol](EVALUATION.md).

The early style test is a feasibility screen, not validation. If it fails, stop describing extraction-only behavior as personal impersonation detection. Narrow the language or revise the value proposition explicitly before continuing. If an enforceable outbound contract cannot be demonstrated, block cloud requests until repaired.

November15 implementation decision: **narrow**. The real synthetic paired pilot did not demonstrate useful incremental personal-context benefit. Keep writing comparison optional and explicitly experimental; describe Hakiki as request inspection and independent-verification support, not an impersonation detector. Exact counts and preserved failures are in EVALUATION.md. Human studies and independent validation remain open.

The previous independent review averaged 3.25/5: technology 3.00, design 3.17, impact 2.83, idea 4.00. These are planning assessments, not judge feedback or implemented quality. The build prioritizes missing evidence over additional features.

## Claims and sources

The original PRD's market-size numbers and competitor assertions are not carried into the public pitch without primary-source verification. Do not invent a personal anchor story; the project owner supplies any lived-experience claim.

The [hackathon overview](https://firebasehybridaihackathon.devpost.com/) establishes the platform choices, required runtime Firebase AI Logic use, App Check requirement, and submission materials. The supplied official-rules text establishes the equal-weight 1–5 scoring and technical-first tiebreak. Specific SDK capabilities, hardware support, token limits, and grounding availability remain Sprint 0 checks against official platform documentation.
