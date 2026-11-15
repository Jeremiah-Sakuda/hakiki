# Implementation evidence and release gates

Updated November 15, 2026. Code completion and demonstrated model capability are separate. This file does not replace PRD acceptance criteria.

| Area                         | Evidence                                                          | State                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Text workflow and consent    | Browser tests and synthetic screenshots                           | Implemented                                                                                                                |
| Strict local/cloud adapters  | SDK 13.3 runtime code, mocked routing tests                       | Implemented; real local result unverified                                                                                  |
| Local model                  | `evidence/local-capability.json`, Chrome 157 Windows              | Unavailable in isolated headed and headless automation profiles; regular browser profile not tested                        |
| Gemini endpoint              | Live Firebase AI Logic request, Soma                              | Vertex cloud inference passed with complete output and two search sources; Developer API credit error preserved separately |
| App Check                    | Dedicated Hakiki app and reCAPTCHA registration; service enforced | Hosted production attestation reached Gemini; Vertex-backed hosted verification follows deployment                         |
| Privacy boundary             | Closed schema, canary tests, no raw-text fallback                 | Tested paths only; not a universal audit                                                                                   |
| Offline shell                | Versioned same-origin service worker                              | Passed hosted offline reload and empty-message check                                                                       |
| Profiles                     | Parser, local-only summarization, consent/storage/deletion        | Real model import unverified                                                                                               |
| Rules benchmark              | 80 synthetic cases, 20 development/60 evaluation                  | 60% coverage, 40% false flags                                                                                              |
| Comparative model evaluation | No fabricated outputs                                             | Not measured                                                                                                               |
| Target-user walkthroughs     | No real participants recruited                                    | Not conducted                                                                                                              |
| iPhone, screenshots, Swahili | Conditional PRD scope                                             | Deferred                                                                                                                   |
| Video and Devpost submission | Owner release actions                                             | Not performed                                                                                                              |

## Remaining hybrid gates

1. Cloud capacity resolved using the approved Vertex backend on existing Soma billing. No billing account was attached and no credits were purchased. Successful inference evidence is a runtime smoke test, not model-quality evaluation.
2. A Chrome device/profile with a downloadable or available model. Demonstrate local comparison and profile creation without raw-data transmission.
3. Real model evaluation and profile ablation. Mock tests cannot establish model usefulness.
4. Consent-based target-user walkthroughs before claiming observed user benefits.

The candidate can be reviewed while these gates remain open. A stable review score is not release acceptance or a guarantee of hackathon eligibility.
