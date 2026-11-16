# Problem, audience, and demonstrated fit

Reviewed November 16, 2026. Primary sources below support the problem; product fit remains a hypothesis where explicitly identified. This is not a fraud-loss estimate or evidence of prevented losses.

## A specific problem with official support

The Central Bank of Kenya explicitly advises people to call first when someone they know requests monetary help by email or text, because the sender may be an impersonator. It also recommends seeking an independent second opinion when uncertain. This directly supports a product centered on checking a family money request and contacting the person independently. [CBK: Fraud Safety, protection guidance](https://www.centralbank.go.ke/fraud-safety/)

The US Federal Trade Commission describes family-emergency impersonation involving urgency, secrecy, and demands for money. Its guidance recommends contacting the relative or friend using a number already known to be correct, and checking with another trusted person if necessary. Familiar personal information or a familiar-sounding voice does not settle identity. This is US guidance about the mechanism, not evidence of its prevalence among Kenyan diaspora households. [FTC: Scammers Use Fake Emergencies To Steal Your Money](https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money)

Kenya has a substantial cross-border transfer context. CBK surveys formal remittance channels monthly. Summing its twelve monthly totals gives approximately **US$4.945 billion in 2024** and **US$5.037 billion in 2025**. Calculation: the table is denominated in USD thousands; annual sums are 4,945,222.59 and 5,036,757.94 thousand dollars. These are remittance flows, not scam exposure, addressable revenue, household counts, or likely Hakiki users. [CBK: Diaspora Remittances](https://www.centralbank.go.ke/diaspora-remittances/)

## Initial audience hypothesis

The initial audience is an **English-speaking Kenyan diaspora sender who can review a family money request on a desktop or laptop** and already has a trusted way to contact the purported sender. We have not established how often this audience encounters impersonation, prefers desktop checks, or will maintain contact arrangements. No interviews, adoption, willingness-to-pay findings, or savings are claimed.

## What the demonstrated product addresses

Hakiki implements a deliberate pause: inspect the request, compare its reviewed categories with arrangements explicitly confirmed outside that request, and choose a previously trusted contact route. It can surface a changed payment method or a request to skip an agreed conversation. These are reasons to clarify, not identity conclusions. Manual contact setup works without a model or chat import.

Private arrangements and raw message text stay local under the implemented application contract; the user can approve fixed categories for public scam-pattern lookup. This gives a concrete reason for the device/cloud split without claiming that either component is indispensable. Six mocked UI state tests cover manual setup, correction, editing/deletion, profile review, and cancellation; they establish interface behavior, not real-user benefit or model quality. See [implementation](../src/App.tsx), [context comparison](../src/context.ts), and [state tests](../tests/e2e/state.spec.ts).

Real local/cloud execution has separate recorded evidence, while local reliability and the revised context hypothesis remain under evaluation. The earlier writing-style pilot did not establish incremental benefit. [Evaluation and preserved limitations](EVALUATION.md); [new context protocol](CONTEXT_EVALUATION.md).

## Alternatives, reach, and limits

A direct call through an existing address book, or a written family agreement, may solve the immediate problem with less effort. Hakiki's proposed added value is remembering arrangements, making the request legible, and connecting it to public explanations without uploading family context. That advantage needs evidence.

Chrome's foundation-model APIs currently require supported desktop operating systems, at least 22 GB free storage, and either more than 4 GB VRAM or a CPU setup with at least 16 GB RAM and four cores. Initial download requires an unmetered connection; the documented foundation models are unavailable on mobile Chrome. These constraints materially narrow reach. A responsive page is not a shipped native mobile/local-AI product. [Chrome: hardware and model requirements](https://developer.chrome.com/docs/ai/get-started#hardware)

The supplied judging rubric asks for a credible, specific case supported by the demonstration; it does not mandate human trials. Official problem evidence plus a working relevant flow can support Potential Impact. Adoption, comprehension, accuracy, and prevented losses remain separate claims requiring further evidence.
