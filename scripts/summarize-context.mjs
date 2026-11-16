import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";

// Evaluation only. Gold observations are derived from independently authored facts
// and the context actually supplied, never from the production comparator.
const inputPath = process.argv[2];
if (!inputPath)
  throw new Error(
    "Usage: node scripts/summarize-context.mjs RUN.json [SUMMARY.json]",
  );
const fixturePath = "eval/context-heldout-v1.json";
const fixtureText = readFileSync(fixturePath, "utf8");
const fixtures = JSON.parse(fixtureText);
const rawText = readFileSync(inputPath, "utf8");
const run = JSON.parse(rawText);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalizedFixtureHash = hash(JSON.stringify(fixtures));
if (run.fixtureSha256 !== normalizedFixtureHash)
  throw new Error(
    "Fixture hash mismatch; do not silently score a different gold set.",
  );
const ids = new Set(fixtures.map((f) => f.id));
const rows = new Map();
for (const row of run.cases) {
  if (!ids.has(row.id) || rows.has(row.id))
    throw new Error(
      "Unknown or duplicate case ID; retries require a separate report.",
    );
  rows.set(row.id, row);
}
const profiles = new Map(fixtures.map((f) => [f.profile.id, f.profile]));
const fields = [
  "requestType",
  "paymentChannel",
  "urgency",
  "secrecyRequested",
  "changedContactClaim",
  "verificationDiscouraged",
];
const variants = [
  "rules_generic",
  "rules_context",
  "local_context",
  "local_omitted",
  "local_wrong_profile",
];
const isUnknown = (value) => value === null || value === "unknown";
const availableContext = (c) =>
  Boolean(
    c?.confirmedAt &&
    (c.moneyRequests === "no_message_requests_confirmed" ||
      c.usualPaymentMethods?.length ||
      c.verificationAgreement === "speak_before_sending"),
  );
function goldDepartures(f, c) {
  if (!availableContext(c) || f.requestType === "unknown") return [];
  const out = [];
  if (c.moneyRequests === "no_message_requests_confirmed")
    out.push("no_message_requests");
  if (
    c.usualPaymentMethods?.length &&
    f.paymentChannel !== "unknown" &&
    !c.usualPaymentMethods.includes(f.paymentChannel)
  )
    out.push("different_payment_method");
  if (
    c.verificationAgreement === "speak_before_sending" &&
    f.verificationDiscouraged === true
  )
    out.push("verification_discouraged");
  return out.sort();
}
const sameSet = (a, b) =>
  JSON.stringify([...new Set(a)].sort()) ===
  JSON.stringify([...new Set(b)].sort());
for (const f of fixtures) {
  if (
    !sameSet(
      f.expected.departureCodes,
      goldDepartures(f.expected.features, f.profile?.context),
    )
  )
    throw new Error(
      `Authored gold consistency failure: ${f.id}; resolve before model outcomes, never relabel silently.`,
    );
}
const items = fixtures.map((fixture, index) => {
  const row = rows.get(fixture.id);
  const wrong =
    profiles.get(row?.local?.wrongProfile?.id) ||
    fixtures[(index + 13) % fixtures.length].profile;
  if (
    row?.local?.status === "completed" &&
    !profiles.has(row.local.wrongProfile?.id)
  )
    throw new Error(`Unknown supplied wrong-profile id: ${fixture.id}`);
  const result = {
    id: fixture.id,
    family: fixture.family,
    stratum: fixture.stratum,
    identity: fixture.identity,
    identityInferable: fixture.identityInferable,
    variants: {},
  };
  for (const variant of variants) {
    const isRules = variant.startsWith("rules_");
    const local = row?.local;
    const status = !row
      ? "unattempted"
      : isRules
        ? row.rules
          ? "completed"
          : "error"
        : local?.status === "completed"
          ? "completed"
          : "error";
    const actualFeatures =
      status === "completed"
        ? isRules
          ? row.rules.features
          : local.result?.suggestedFeatures
        : null;
    let observations = [];
    let suppliedContext = fixture.profile?.context;
    if (variant === "rules_context")
      observations = row?.rules?.observations || [];
    if (variant === "local_context") observations = local?.observations || [];
    if (variant === "local_omitted") {
      observations = local?.omitted || [];
      suppliedContext = undefined;
    }
    if (variant === "local_wrong_profile") {
      observations = local?.wrongProfile?.observations || [];
      suppliedContext = wrong?.context;
    }
    const expectedCodes =
      variant === "local_omitted"
        ? []
        : variant === "local_wrong_profile"
          ? goldDepartures(fixture.expected.features, suppliedContext)
          : fixture.expected.departureCodes;
    const emittedCodes =
      status === "completed"
        ? [
            ...new Set(
              observations
                .filter((o) => o.kind === "departure")
                .map((o) => o.code),
            ),
          ].sort()
        : [];
    const correctCodes = emittedCodes.filter((code) =>
      expectedCodes.includes(code),
    );
    const unexpectedCodes = emittedCodes.filter(
      (code) => !expectedCodes.includes(code),
    );
    const missedCodes = expectedCodes.filter(
      (code) => !emittedCodes.includes(code),
    );
    result.variants[variant] = {
      status,
      expectedCodes,
      emittedCodes,
      correctCodes,
      unexpectedCodes,
      missedCodes,
      expectedFeatures: fixture.expected.features,
      actualFeatures,
      exactCategories:
        status === "completed" &&
        actualFeatures?.schemaVersion === 1 &&
        fields.every((k) => actualFeatures[k] === fixture.expected.features[k]),
      exactDepartureSet:
        status === "completed" && sameSet(expectedCodes, emittedCodes),
      contextUnavailableExpected:
        variant === "rules_generic" ? null : !availableContext(suppliedContext),
      contextUnavailableShown:
        status === "completed" &&
        observations.some(
          (o) => o.code === "no_confirmed_context" && o.kind === "unavailable",
        ),
      errorCode:
        status === "error" ? local?.diagnostic?.code || "not_recorded" : null,
      elapsedMs:
        !isRules && status === "completed" ? local?.result?.elapsedMs : null,
    };
  }
  return result;
});
const rate = (n, d) => (d ? n / d : null);
const percentile = (values, p) => {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.max(0, Math.ceil(p * s.length) - 1)] : null;
};
function metrics(selected, variant) {
  const vs = selected.map((i) => i.variants[variant]);
  const total = vs.length;
  const count = {
    cases: total,
    completed: 0,
    errors: 0,
    unattempted: 0,
    expectedDepartureCodes: 0,
    emittedDepartureCodes: 0,
    correctDepartureCodes: 0,
    unexpectedDepartureCodes: 0,
    missedDepartureCodes: 0,
    positiveDepartureCases: 0,
    positiveCasesWithAnyCorrectDeparture: 0,
    noDepartureCases: 0,
    falseDepartureCasesOnNoDepartureGold: 0,
    unexpectedDepartureCasesOnPositiveGold: 0,
    exactCategoryCases: 0,
    exactDepartureSetCases: 0,
    unknownFieldGold: 0,
    unknownFieldsCorrect: 0,
    noContextCases: 0,
    noContextCorrectlyShown: 0,
    noContextCasesWithInventedDeparture: 0,
  };
  const fieldCounts = Object.fromEntries(
    fields.map((k) => [
      k,
      { correct: 0, total, expectedUnknown: 0, unknownCorrect: 0 },
    ]),
  );
  const errorCodes = {};
  for (const v of vs) {
    count[
      v.status === "completed"
        ? "completed"
        : v.status === "unattempted"
          ? "unattempted"
          : "errors"
    ]++;
    if (v.status === "error")
      errorCodes[v.errorCode] = (errorCodes[v.errorCode] || 0) + 1;
    count.expectedDepartureCodes += v.expectedCodes.length;
    count.emittedDepartureCodes += v.emittedCodes.length;
    count.correctDepartureCodes += v.correctCodes.length;
    count.unexpectedDepartureCodes += v.unexpectedCodes.length;
    count.missedDepartureCodes += v.missedCodes.length;
    if (v.expectedCodes.length) {
      count.positiveDepartureCases++;
      if (v.correctCodes.length) count.positiveCasesWithAnyCorrectDeparture++;
      if (v.unexpectedCodes.length)
        count.unexpectedDepartureCasesOnPositiveGold++;
    } else {
      count.noDepartureCases++;
      if (v.unexpectedCodes.length)
        count.falseDepartureCasesOnNoDepartureGold++;
    }
    if (v.exactCategories) count.exactCategoryCases++;
    if (v.exactDepartureSet) count.exactDepartureSetCases++;
    if (v.contextUnavailableExpected) {
      count.noContextCases++;
      if (v.contextUnavailableShown) count.noContextCorrectlyShown++;
      if (v.emittedCodes.length) count.noContextCasesWithInventedDeparture++;
    }
    for (const k of fields) {
      const good =
        v.status === "completed" &&
        v.actualFeatures?.[k] === v.expectedFeatures[k];
      if (good) fieldCounts[k].correct++;
      if (isUnknown(v.expectedFeatures[k])) {
        count.unknownFieldGold++;
        fieldCounts[k].expectedUnknown++;
        if (good) {
          count.unknownFieldsCorrect++;
          fieldCounts[k].unknownCorrect++;
        }
      }
    }
  }
  const precision = rate(
    count.correctDepartureCodes,
    count.emittedDepartureCodes,
  );
  const recall = rate(
    count.correctDepartureCodes,
    count.expectedDepartureCodes,
  );
  const fpr = rate(
    count.falseDepartureCasesOnNoDepartureGold,
    count.noDepartureCases,
  );
  return {
    ...count,
    departurePrecision: precision,
    departureRecallFirstAttempt: recall,
    falseDepartureCaseRate: fpr,
    fullCategoryAccuracyFirstAttempt: rate(count.exactCategoryCases, total),
    exactDepartureSetAccuracyFirstAttempt: rate(
      count.exactDepartureSetCases,
      total,
    ),
    unknownFieldAccuracyFirstAttempt: rate(
      count.unknownFieldsCorrect,
      count.unknownFieldGold,
    ),
    contextUnavailableHandlingFirstAttempt: rate(
      count.noContextCorrectlyShown,
      count.noContextCases,
    ),
    perField: Object.fromEntries(
      fields.map((k) => [
        k,
        {
          ...fieldCounts[k],
          accuracyFirstAttempt: rate(fieldCounts[k].correct, total),
          unknownAccuracyFirstAttempt: rate(
            fieldCounts[k].unknownCorrect,
            fieldCounts[k].expectedUnknown,
          ),
        },
      ]),
    ),
    errorCodes,
    medianCompletedMs: percentile(
      vs.map((v) => v.elapsedMs),
      0.5,
    ),
    p95CompletedMs: percentile(
      vs.map((v) => v.elapsedMs),
      0.95,
    ),
    predeclaredTargetChecks: {
      precisionAtLeast90Percent: precision === null ? null : precision >= 0.9,
      recallAtLeast80Percent: recall === null ? null : recall >= 0.8,
      falseDepartureCasesAtMost10Percent: fpr === null ? null : fpr <= 0.1,
      criticalViolations:
        "Not certified by this exact-label scorer; separate network and blinded prose review required.",
    },
  };
}
const group = (key) =>
  Object.fromEntries(
    [...new Set(items.map((i) => i[key]))].sort().map((value) => [
      value,
      Object.fromEntries(
        variants.map((v) => [
          v,
          metrics(
            items.filter((i) => i[key] === value),
            v,
          ),
        ]),
      ),
    ]),
  );
const pairedComparison = {
  cases: items.length,
  departureSet: {
    localCorrectRulesWrong: 0,
    rulesCorrectLocalWrong: 0,
    bothCorrect: 0,
    bothWrong: 0,
  },
  fullCategories: {
    localCorrectRulesWrong: 0,
    rulesCorrectLocalWrong: 0,
    bothCorrect: 0,
    bothWrong: 0,
  },
  localErrorOrUnattempted: 0,
};
for (const item of items) {
  const a = item.variants.local_context,
    b = item.variants.rules_context;
  if (a.status !== "completed") pairedComparison.localErrorOrUnattempted++;
  for (const [name, key] of [
    ["departureSet", "exactDepartureSet"],
    ["fullCategories", "exactCategories"],
  ]) {
    const bucket = a[key]
      ? b[key]
        ? "bothCorrect"
        : "localCorrectRulesWrong"
      : b[key]
        ? "rulesCorrectLocalWrong"
        : "bothWrong";
    pairedComparison[name][bucket]++;
  }
}
const summary = {
  createdAt: new Date().toISOString(),
  protocol:
    "Confirmed arrangements v1; independently authored synthetic cases; exact facts/departures, not identity accuracy",
  rawRunPath: inputPath,
  rawRunSha256: hash(rawText),
  fixturePath,
  fixtureFileSha256: hash(fixtureText),
  fixtureNormalizedSha256: normalizedFixtureHash,
  scorerSha256: hash(readFileSync(new URL(import.meta.url))),
  sourceProvenance: run.provenance,
  complete: run.complete === true && rows.size === fixtures.length,
  expectedCases: fixtures.length,
  attemptedCases: rows.size,
  firstAttemptsOnly: true,
  overall: Object.fromEntries(variants.map((v) => [v, metrics(items, v)])),
  byStratum: group("stratum"),
  byAuthoredIdentity: group("identity"),
  byFamily: group("family"),
  cloud: {
    attempts: run.cases.filter((c) => c.cloud).length,
    completed: run.cases.filter((c) => c.cloud?.status === "completed").length,
    errors: run.cases.filter((c) => c.cloud?.status === "error").length,
    quality:
      "Unrated; six-or-fewer exploratory responses, not a validated cloud/hybrid quality benchmark.",
  },
  privacy: run.privacy,
  outcomes: items,
  limitations: [
    "All 48 cases are authored synthetic English scenarios, with 24 related families.",
    "Generic rules cannot emit saved-arrangement departure codes: its departure recall is a capability reference, not an equal-task fraud classifier.",
    "Local omitted/wrong-profile conditions reuse one extraction per case and are not independent inference runs.",
    "Wrong-profile gold uses independently labeled request facts and the context actually supplied, not the original person’s preferences.",
    "Errors and unattempted cases remain in first-attempt recall/category denominators; precision alone can conceal missing outputs.",
    "No human usability, identity detection accuracy, prevented-loss, or population reliability claim is established.",
    "Do not tune on revealed outcomes and label a rerun held-out.",
  ],
};
const outputPath =
  process.argv[3] ||
  join(dirname(inputPath), `${basename(inputPath, ".json")}-summary.json`);
summary.pairedLocalVsRulesContext = pairedComparison;
summary.localVariantMeaning =
  "Model-assisted request interpretation plus existing rules plus deterministic confirmed-context comparison; not six-field pure-model extraction.";
summary.localFieldSources = {
  requestType:
    "Model financial-request presence with emergency classification gated by existing deterministic rules",
  paymentChannel: "Model, exact quote checked",
  verificationDiscouraged: "Model, exact quote checked",
  urgency: "Existing deterministic rules",
  secrecyRequested: "Existing deterministic rules",
  changedContactClaim: "Existing deterministic rules",
};
writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n");
// Blinded packet excludes variant labels, author identity, expected labels and case IDs.
// A separate private key enables adjudication after both independent ratings.
const packet = [];
const key = [];
for (const fixture of fixtures) {
  const row = rows.get(fixture.id);
  if (!row) continue;
  const wrong = profiles.get(row.local?.wrongProfile?.id);
  for (const [variant, observations, context] of [
    ["rules_context", row.rules?.observations, fixture.profile?.context],
    [
      "local_context",
      row.local?.status === "completed" ? row.local.observations : null,
      fixture.profile?.context,
    ],
    [
      "local_omitted",
      row.local?.status === "completed" ? row.local.omitted : null,
      null,
    ],
    [
      "local_wrong_profile",
      row.local?.status === "completed"
        ? row.local.wrongProfile?.observations
        : null,
      wrong?.context,
    ],
  ]) {
    if (!observations) continue;
    const id = hash(`${summary.rawRunSha256}:${fixture.id}:${variant}`).slice(
      0,
      16,
    );
    packet.push({
      reviewId: id,
      request: fixture.text,
      confirmedContext: context || null,
      genericWarnings:
        variant === "rules_context"
          ? row.rules.genericSignals
          : row.local?.result?.signals || [],
      writingObservations:
        variant === "rules_context"
          ? []
          : row.local?.result?.personal?.observations || [],
      interpretationEvidence:
        variant === "rules_context" ? [] : row.local?.result?.evidence || [],
      rejectedFields:
        variant === "rules_context"
          ? []
          : row.local?.result?.rejectedFields || [],
      observations: observations.map(({ kind, text, action }) => ({
        kind,
        text,
        action,
      })),
    });
    key.push({ reviewId: id, caseId: fixture.id, variant });
  }
  if (row.cloud?.status === "completed") {
    const id = hash(`${summary.rawRunSha256}:${fixture.id}:cloud`).slice(0, 16);
    packet.push({
      reviewId: id,
      permittedCategories: row.cloud.input,
      response: row.cloud.result.text,
      sources: row.cloud.result.sources || [],
    });
    key.push({ reviewId: id, caseId: fixture.id, variant: "cloud_shared" });
  }
}
packet.sort((a, b) => a.reviewId.localeCompare(b.reviewId));
const prefix = outputPath.replace(/\.json$/, "");
writeFileSync(
  `${prefix}-blinded.json`,
  JSON.stringify(
    {
      instructions:
        "Two AI reviewers independently assess supported facts, action suitability, unsupported identity claims and instruction following. No human validation implied. Do not open the separate key before rating.",
      items: packet,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(`${prefix}-blind-key.json`, JSON.stringify(key, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      outputPath,
      complete: summary.complete,
      expectedCases: summary.expectedCases,
      attemptedCases: summary.attemptedCases,
      blindedItems: packet.length,
      overall: summary.overall,
    },
    null,
    2,
  ),
);
