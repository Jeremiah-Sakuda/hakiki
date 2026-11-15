# Hakiki

A private second opinion on money requests that claim to come from someone you know.

Hakiki is being designed to combine on-device relationship context with cloud scam intelligence through Firebase AI Logic. Its purpose is to help people choose an independent way to verify a request. It does not authenticate a sender or certify a message as safe.

**Status: planning and repository setup. No application, model integration, or evaluation results have been implemented yet.**

## Build documents

- [Sprint build plan](docs/BUILD_PLAN.md): dates, tasks, dependencies, acceptance criteria, and release gates.
- [Product requirements](docs/PRD.md): the revised scope and user experience.
- [Privacy and architecture](docs/PRIVACY.md): permitted cloud inputs, local data, and failure behavior.
- [Evaluation protocol](docs/EVALUATION.md): comparative testing, false alarms, and user walkthroughs.

## Delivery target

The initial target is desktop Chrome for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/). The submission deadline is November 30, 2026 at 5:00 PM America/New_York. The internal submission target is noon that day.

| Sprint | Dates in 2026 | Outcome |
| --- | --- | --- |
| 0 | Nov 15–16 | Validate the SDK path and personal-context hypothesis |
| 1 | Nov 17–19 | Complete a text-based check with and without a contact profile |
| 2 | Nov 20–23 | Enforce the cloud boundary and finish failure states |
| 3 | Nov 24–26 | Measure accuracy, false alarms, and user understanding |
| 4 | Nov 27–30 | Stabilize, record, and submit |

iPhone is conditional scope. Android, community pattern collection, and an automatic playbook-refresh service are outside the hackathon baseline.

## Development setup

This initial commit contains documentation and repository conventions only. Sprint 0 will verify the supported Firebase AI Logic SDK version and provision the development environment. Sprint 1 will add the application and exact install, test, and run commands. There is currently no runnable demo.

The proposed web implementation is TypeScript with React and Vite, Firebase AI Logic, App Check, Remote Config, and Firebase Hosting. These are implementation choices to confirm in Sprint 0, not installed dependencies. No Firebase project or cloud resources have been provisioned by this repository setup.

Do not commit private chat exports, screenshots, contact profiles, credentials, App Check debug tokens, or raw evaluation records. Use synthetic fixtures in the public repository. See [privacy requirements](docs/PRIVACY.md).

## License

[Apache License 2.0](LICENSE).
