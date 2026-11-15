# Hakiki — Devpost draft

This is a draft, not a submitted entry. Resolve the exact Nano4 requirement and add a public demonstration video before submission. No personal origin story or user-impact claim is implied.

## Short description

A private second opinion on family money requests: inspect the request, share only approved categories with cloud AI, and verify through a contact route you already trust.

## Inspiration

An urgent request from a familiar person can be hard to assess. Hakiki explores whether private writing context and public scam-pattern information can help someone pause before acting, without uploading their conversations.

## What it does

Paste a request, optionally select a locally stored contact, and review observations. Compatible desktop Chrome can compare writing on-device through Firebase AI Logic. A text-rule fallback is clearly labeled when local AI cannot finish. Imported WhatsApp text is summarized locally; users review and edit the profile before saving it in their browser.

The user reviews fixed categories before approving a cloud check. Raw messages, names, numbers, contact history, and personal comparison findings are excluded from the cloud generation request. The result shows cloud sources, a request receipt, and an action: contact the person through a previously trusted route. Hakiki does not authenticate senders or declare requests safe.

## How it was built

React and TypeScript on Firebase Hosting, with Firebase AI Logic13.3, Chrome Prompt API, Gemini3.8 Flash through the Agent Platform/Vertex backend, App Check, Google Search grounding, and namespaced Remote Config defaults. Separate named local/cloud Firebase instances ensure cloud attestation is initialized before the cached cloud AI service. Structured local output, session cancellation, strict outbound categories, and an offline app shell support the privacy boundary.

## Challenges and lessons

Real tests exposed initialization ordering, model cold starts, profile summaries repeating private text, and stale browser caching. Fixes included separate SDK instances, bounded/cancelled local operations, profile review before persistence, and explicit checks of the deployed scripts and offline shell.

A real12-case authored synthetic pilot completed six profiles and36 local comparisons. On eight evaluation cases, matched profiles flagged one of four imposters and two of four genuine requests, with five abstentions. This did not demonstrate benefit over rules. Writing context is therefore experimental; no fraud-detection accuracy or real-world prevention claim is made. A later current-build local request also fell back, so consistent local reliability remains unestablished.

## What is verified

Real same-page local and approved cloud inference, offline local comparison, reviewed profile import, App Check, source attribution, and raw-text canary exclusion were exercised. The final code has45 passing unit tests; browser regression and live-test evidence are linked in the repository. A three-agent review panel stabilized at3.42/5; this is not an official judging score.

## Next steps

Investigate intermittent local inference, independently evaluate cloud/hybrid usefulness, conduct voluntary target-user walkthroughs, and confirm the competition's exact on-device model requirement. Chrome reported nano_v3_gpu_component; the Web SDK did not expose a documented Nano-generation selector. iPhone, screenshot input, and Swahili quality are not claimed.

## Links and release materials

- App: https://hakiki-hybrid-2026.web.app
- Source: https://github.com/Jeremiah-Sakuda/hakiki
- Evidence: https://github.com/Jeremiah-Sakuda/hakiki/tree/main/docs/evidence
- Status and review caveats: docs/STATUS.md and docs/REVIEWS.md
- Public video: not yet recorded/published. Use the three-minute sequence in docs/BUILD_PLAN.md, showing the actual supported Chrome experience and its limitations.
