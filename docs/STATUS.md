# Implementation evidence and release gates

Updated November 15, 2026. Working software, demonstrated usefulness, and competition eligibility are separate.

| Area | Evidence | State |
| --- | --- | --- |
| Text workflow, consent, correction, deletion | Normal browser regression suite | Passed |
| Strict local/cloud adapters | SDK13.3 runtime, unit routing tests, real response locations | Implemented and exercised |
| Local comparison and profile generation | evidence/local-inference.json; isolated Chrome157 Windows | Real inference and review/edit-before-save flow passed |
| Cloud inference | evidence/cloud-transport.json; hosted Soma Vertex route | Complete output, three sources, production App Check passed |
| Privacy boundary | Closed categorical schema, canary tests, no raw fallback | Tested paths passed; not a universal audit |
| Profile storage | Explicit review/edit before persistence; deletion | Local plaintext; model summaries may contain private details |
| Offline shell | Versioned same-origin service worker | Hosted offline reload passed; message not retained |
| Rules benchmark | 80 authored synthetic cases, 20 development/60 evaluation | 60% cue coverage, 40% false flags; not validated accuracy |
| Paired model pilot | Real adapter runner with matched/omitted/wrong profiles | In progress; preserves failures separately |
| Exact Nano4 eligibility | docs/MODEL_ELIGIBILITY.md | Unconfirmed; browser reports nano_v3 asset |
| Target-user walkthroughs | No real participants recruited | Not conducted |
| iPhone, screenshots, Swahili | Conditional P1 scope | Deferred |
| Video and Devpost submission | Owner release actions | Not performed |

Cloud capacity was resolved through the approved Vertex backend on existing Soma billing. No billing account was attached and no credits were purchased. Successful inference is runtime evidence, not model-quality validation. Remote Config reads a namespaced version label with a bundled default; the shared Soma template has not been overwritten.

Remaining evidence gates are comparative usefulness, consent-based target-user walkthroughs, exact required local model eligibility, and release materials. Stable AI-reviewer scores do not close those gates or guarantee eligibility.

