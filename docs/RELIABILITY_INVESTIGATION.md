# Local inference investigation, November 16

The earlier hosted fallback had no detailed diagnostics, so its exact cause cannot be reconstructed. This investigation preserves newly observed failures rather than assuming that one successful repeat resolves the old one.

## Observations before the final candidate

- Added fixed-category stage/timing diagnostics, bounded availability/setup, cancellation and late-result protection. No native exception text or private input/output is retained in application diagnostics.
- The first four synthetic development requests completed twice and timed out twice at generation. Development hot reloads occurred during this run, so it cannot isolate a native defect. See `evidence/context-development-before-fix.json`.
- A trace of the subsequent run showed availability and session creation succeeding, with the first native prompt remaining pending. Later attempts stalled at session creation. Aborting only the creation signal did not produce a prompt terminal event in that trace. See `evidence/context-native-stall.json` and `scripts/native-trace.mjs`.
- The SDK forwards prompt options to Chrome unchanged. Added the same abort signal to both creation and prompting, using Chrome's documented prompt cancellation option. A direct native streaming probe settled with AbortError within milliseconds when both signals were aborted. Unit tests verify both signals and late-result protection.
- A plain native response completed. A complex constrained response instead emitted many whitespace chunks without completing valid JSON. Removing only the JSON Schema draft URI produced one successful native probe, but the four-request SDK repeat still timed out on every request. Metadata removal alone is **not a demonstrated fix**; see `evidence/context-development-metadata-only.json`.

The investigation therefore separates output-format complexity, native completion/cancellation, and application behavior. Neither a retry nor a changed timeout is evidence that extraction quality or reliability improved. A final prospective consecutive-run protocol is defined in CONTEXT_EVALUATION.md, separately from these exploratory diagnostics.

References: [Chrome Prompt API cancellation](https://developer.chrome.com/docs/ai/prompt-api#stop_prompting), [Firebase constrained on-device output](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output). Direct native probes are diagnostics only; production inference remains through Firebase AI Logic.

## Prospective candidate and independent review

Flat streamed output completed four development SDK checks but exposed fabricated secrecy assertions. Version 2026-11-16.3 narrowed the model to financial request, payment method and verification; existing text rules supply the other cues. Its four separate development checks completed with the expected categories. The first frozen consecutive run (`reliability-2026-11-16T23-32-17-491Z.json`) completed 25/25 comparisons/recovery, 3/3 setup operations, 2/3 profile generations and 2/2 cloud operations; deliberate cancellation returned the expected cancelled diagnostic. Comparison median was 4,683ms and p95 20,328ms. The profile timeout remains in the report.

Version 2026-11-16.4 removes native string-length constraints from profile generation, retaining the strict 10–600 character runtime validator and bounded streaming. Independent review also found and fixed a stale manual editor that could overwrite newly saved writing context. The next complete run must establish the amended candidate's actual counts; the earlier failure is not erased.
