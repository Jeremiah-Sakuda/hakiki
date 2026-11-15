# Hakiki privacy and architecture contract

This is the implementation contract. See STATUS.md and the recorded evidence for which paths have been tested; finite tests are not a universal privacy audit.

## Data flow

1. Raw request, optional screenshot, and imported conversation enter local processing only.
2. A strictly on-device model compares the request with a compact local profile. Missing capability is an explicit failure state, not permission to use cloud inference.
3. A deterministic validator converts local extraction or user selections into a closed set of cloud feature fields. No model-generated free text crosses this boundary.
4. The user sees those fields and approves a cloud request through Firebase AI Logic. Fixed system prompts contain no user text.
5. The cloud returns generic scam-pattern evidence. The browser validates it and combines it with personal findings locally. Static localized templates render the card; the baseline has no cloud card-writer step.
6. The application records a receipt from the serialized request at the send boundary and the returned execution metadata. An independent network inspection verifies the receipt and checks other outbound services.

## Candidate outbound schema

The implemented strict schema is defined in `src/domain.ts`. This is an allowed example:

```json
{
  "schemaVersion": 1,
  "requestType": "emergency_money",
  "paymentChannel": "mobile_money",
  "urgency": "immediate",
  "secrecyRequested": true,
  "changedContactClaim": true,
  "verificationDiscouraged": true
}
```

All categorical fields must include `unknown` where applicable; unknown boolean facts use `null`. Allowed values are constants in application code. Reject additional keys, nested arbitrary data, invalid enum strings, and oversized input. Never include names, phone numbers, account identifiers, amounts, codes, exact dates, URLs, narrative summaries, contact IDs, personal comparison findings, or request text. These categories still reveal limited facts about a request; describe them accurately rather than claiming anonymization or zero disclosure.

The no-local-model flow uses simple deterministic rules and user-selected categories. It cannot produce a personal comparison or import a model-built profile. Inability to extract useful categories leads to manual verification guidance, not relaxed validation.

## Storage and network boundaries

| Data | Location and lifetime |
| --- | --- |
| Raw request and screenshot | Memory for the current check; clear on reset; no default persistence |
| Imported chat export | Local processing only; release original contents after deriving the profile |
| Compact contact profile and saved contact route | Local opt-in storage with per-contact and delete-all controls; document actual browser storage protection |
| Approved features and receipt | Memory by default; local export only by explicit user action |
| Synthetic demo fixtures | Public repository; clearly fictional and licensed for use |
| Consented private evaluation data | Ignored local directory; no cloud transfer of raw records; publish aggregate counts only |
| Configuration/playbook | Bundled defaults and versioned Remote Config values; no user records |

Do not claim local storage is encrypted unless implemented and verified. Device access, browser backups, XSS, network metadata, and cloud retention of permitted inputs are separate limitations to disclose accurately. Do not enable analytics or crash logging that captures prompts, screenshots, profiles, or receipts. Hosting, App Check, Remote Config, and optional Authentication may emit infrastructure metadata; document observed endpoints separately from AI content. The receipt must be labeled accordingly rather than claiming to list every network byte.

## Trust boundaries and failure rules

- Treat incoming messages, exports, and model outputs as untrusted data, including embedded prompt instructions.
- Build the outbound object with an explicit field allowlist. Remote Config may tune prompts but cannot widen this schema or enable raw-text fallback.
- Validate cloud responses and source URLs. Render text safely; never execute model-produced HTML or actions.
- Only offer previously saved contact routes. A number or link in a suspicious request is not a trusted verification route.
- Timeouts, invalid JSON, unsupported inputs, schema failures, and no-local-model errors must fail closed for raw data.
- A failed request still appears in the receipt if transmission occurred. Retries require consent tied to the current preview; duplicate sends are prevented.
- Offline requests remain local. Reconnection does not grant permission to send.

## Required verification evidence

Use canary names, codes, numbers, distinctive narrative phrases, malicious instructions, and Unicode variants in synthetic fixtures. Assert that prohibited values never occur in cloud request bodies, query strings, headers under application control, logs, or error reporting. Inspect every application network path, including import, model failure, card rendering, retry, offline recovery, and screenshot processing.

Record browser/device, SDK version, prompt/config version, observed destinations, serialized content, and whether the response reports local or cloud execution. Compare independent network captures with the receipt. Keep captures containing sensitive infrastructure tokens private and publish sanitized evidence only.

Release requires zero prohibited-content transmissions in the adversarial test suite. Passing a finite suite supports a bounded claim about tested paths; it does not prove that no future leak is possible.
