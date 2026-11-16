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
