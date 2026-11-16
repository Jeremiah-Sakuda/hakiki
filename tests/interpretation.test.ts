import { describe, it, expect } from "vitest";
import { extractFeatures } from "../src/domain";
import {
  parseInterpretation,
  interpretationPrompt,
  interpretationConstraint,
  writingInterpretationConstraint,
} from "../src/interpretation";
const output = () => ({
  requestType: "money_request",
  requestTypeQuote: "send money",
  paymentChannel: "bank_transfer",
  paymentChannelQuote: "bank",
  verification: "encouraged",
  verificationQuote: "call first",
});
describe("local evidence boundary", () => {
  it("keeps urgency, secrecy, and contact claims exclusively rule-derived", () => {
    const text =
      "Please send money now. Keep this secret. This is my new number.";
    const rule = extractFeatures(text);
    const result = parseInterpretation(
      {
        ...output(),
        paymentChannel: "unknown",
        paymentChannelQuote: "",
        verification: "unknown",
        verificationQuote: "",
      },
      text,
    );
    expect(result.features).toMatchObject({
      urgency: rule.urgency,
      secrecyRequested: rule.secrecyRequested,
      changedContactClaim: rule.changedContactClaim,
    });
    expect(result.evidence.map((e) => e.field)).toEqual(["requestType"]);
    expect(() =>
      parseInterpretation({ ...output(), secrecy: "requested" }, text),
    ).toThrow();
  });
  it("requires both supported model request evidence and a rule emergency cue", () => {
    const ordinary = parseInterpretation(
      output(),
      "Please send money for a ticket by bank; call first.",
    );
    expect(ordinary.features.requestType).toBe("ordinary_money");
    const text = "Please send money. There is an emergency.";
    const emergency = parseInterpretation(
      {
        ...output(),
        paymentChannel: "unknown",
        paymentChannelQuote: "",
        verification: "unknown",
        verificationQuote: "",
      },
      text,
    );
    expect(emergency.features.requestType).toBe("emergency_money");
    expect(
      parseInterpretation(
        { ...output(), requestType: "unknown", requestTypeQuote: "" },
        text,
      ).features.requestType,
    ).toBe("unknown");
    expect(
      parseInterpretation(
        { ...output(), requestTypeQuote: "unsupported" },
        text,
      ).features.requestType,
    ).toBe("unknown");
  });
  it("does not replace model unknowns or unsupported exact spans with rule guesses", () => {
    const text = "Please send money by bank. Do not call.";
    const unknown = {
      ...output(),
      requestType: "unknown",
      requestTypeQuote: "",
      paymentChannel: "unknown",
      paymentChannelQuote: "",
      verification: "unknown",
      verificationQuote: "",
    };
    expect(parseInterpretation(unknown, text).features).toMatchObject({
      requestType: "unknown",
      paymentChannel: "unknown",
      verificationDiscouraged: null,
    });
    expect(
      parseInterpretation(
        {
          ...output(),
          requestTypeQuote: "SEND MONEY",
          paymentChannelQuote: "BANK",
          verificationQuote: "DO NOT CALL",
        },
        text,
      ).rejectedFields,
    ).toHaveLength(3);
  });
  it("keeps supported categories and direct quotes separate from cloud features", () => {
    const result = parseInterpretation(
      output(),
      "Please send money by bank; call first.",
    );
    expect(result.features.requestType).toBe("ordinary_money");
    expect(result.features.verificationDiscouraged).toBe(false);
    expect(result.evidence).toHaveLength(3);
    expect(JSON.stringify(result.features)).not.toContain("call first");
  });
  it("downgrades unsupported positive and negative assertions without inventing evidence", () => {
    const result = parseInterpretation(output(), "Hello there");
    expect(result.features.requestType).toBe("unknown");
    expect(result.features.paymentChannel).toBe("unknown");
    expect(result.features.verificationDiscouraged).toBeNull();
    expect(result.rejectedFields).toHaveLength(3);
  });
  it("rejects extra personal data and invented enum fields", () => {
    expect(() =>
      parseInterpretation({ ...output(), identity: "safe" }, "send money"),
    ).toThrow();
    const value = output();
    value.paymentChannel = "safe";
    expect(() => parseInterpretation(value, "send money")).toThrow();
  });
  it("does not accept evidence beyond the bounded input", () => {
    expect(
      parseInterpretation(
        output(),
        "x".repeat(4000) + "send money bank call first",
      ).evidence,
    ).toHaveLength(0);
    expect(interpretationPrompt("x".repeat(4000) + "SECRET")).not.toContain(
      "SECRET",
    );
  });
  it("uses a flat native constraint but retains strict runtime quote limits", () => {
    expect(JSON.stringify(interpretationConstraint)).not.toMatch(
      /\$schema|maxLength|anyOf/,
    );
    expect(interpretationConstraint).toMatchObject({
      additionalProperties: false,
    });
    expect(() =>
      parseInterpretation(
        { ...output(), requestTypeQuote: "x".repeat(501) },
        "x".repeat(501),
      ),
    ).toThrow();
    expect(
      parseInterpretation(output(), "send money bank call first").personal,
    ).toEqual({
      languageMatch: "unknown",
      toneMatch: "unknown",
      observations: [],
    });
    expect(writingInterpretationConstraint).toMatchObject({
      properties: {
        languageMatch: expect.anything(),
        toneMatch: expect.anything(),
        observations: expect.anything(),
      },
    });
  });
});
