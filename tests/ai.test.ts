import { beforeEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  generateContent: vi.fn(),
  initializeDeviceModel: vi.fn(),
  getGenerativeModel: vi.fn(),
  initializeAppCheck: vi.fn(),
  apps: [] as { name: string }[],
  attested: new Set<object>(),
  services: new Map<object, { attested: boolean }>(),
  getAI: vi.fn(),
}));
vi.mock("firebase/app", () => ({
  initializeApp: (_config: unknown, name: string) => {
    const app = { name };
    fake.apps.push(app);
    return app;
  },
  getApps: () => fake.apps,
}));
vi.mock("firebase/ai", () => ({
  getAI: fake.getAI,
  getGenerativeModel: fake.getGenerativeModel,
  GoogleAIBackend: class {},
  AgentPlatformBackend: class {},
  InferenceMode: {
    ONLY_ON_DEVICE: "only_on_device",
    ONLY_IN_CLOUD: "only_in_cloud",
  },
  InferenceSource: { ON_DEVICE: "on_device", IN_CLOUD: "in_cloud" },
}));
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: fake.initializeAppCheck,
  ReCaptchaEnterpriseProvider: class {},
}));
vi.mock("firebase/remote-config", () => ({
  getRemoteConfig: () => ({}),
  fetchAndActivate: vi.fn(),
  getString: () => "",
}));
import { extractFeatures, sampleProfile } from "../src/domain";
const interpretation = (personal: Record<string, unknown> = {}) => ({
  languageMatch: "unknown",
  toneMatch: "unknown",
  observations: [],
  ...personal,
  facts: {
    requestType: { value: "unknown", quote: "" },
    paymentChannel: { value: "unknown", quote: "" },
    urgency: { value: "unknown", quote: "" },
    secrecyRequested: { value: null, quote: "" },
    changedContactClaim: { value: null, quote: "" },
    verificationDiscouraged: { value: null, quote: "" },
  },
});
describe("local reliability diagnostics (mocked native lifecycle)", () => {
  it("bounds availability without starting SDK generation or leaking native errors", async () => {
    vi.useFakeTimers();
    try {
      const ai = await import("../src/ai");
      vi.stubGlobal("LanguageModel", {
        availability: () => new Promise(() => {}),
      });
      const pending = ai.localAvailability();
      await vi.advanceTimersByTimeAsync(5000);
      await expect(pending).resolves.toBe("unavailable");
      expect(ai.getLocalDiagnostics().at(-1)).toMatchObject({
        operation: "availability",
        stage: "availability",
        code: "timeout",
      });
      vi.stubGlobal("LanguageModel", {
        availability: async () => {
          throw new Error("PRIVATE_CANARY");
        },
      });
      await expect(ai.localAvailability()).resolves.toBe("unavailable");
      expect(ai.getLocalDiagnostics().at(-1)?.code).toBe("native_error");
      expect(JSON.stringify(ai.getLocalDiagnostics())).not.toContain(
        "PRIVATE_CANARY",
      );
      expect(fake.getGenerativeModel).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("times out setup, ignores late readiness, and permits a fresh successful setup", async () => {
    vi.useFakeTimers();
    try {
      const ai = await import("../src/ai");
      let finish!: () => void;
      fake.initializeDeviceModel.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      const pending = ai.prepareLocal(() => {});
      const rejected = expect(pending).rejects.toMatchObject({
        diagnostic: {
          operation: "setup",
          stage: "initialization",
          code: "timeout",
        },
      });
      await vi.advanceTimersByTimeAsync(600000);
      await rejected;
      const failedSignal =
        fake.getGenerativeModel.mock.calls[0][1].onDeviceParams.createOptions
          .signal;
      expect(failedSignal.aborted).toBe(true);
      finish();
      await Promise.resolve();
      await expect(
        ai.analyzeLocal("message", undefined, ""),
      ).rejects.toMatchObject({ diagnostic: { code: "not_ready" } });
      fake.initializeDeviceModel.mockResolvedValue(undefined);
      await ai.prepareLocal(() => {});
      fake.generateContent.mockResolvedValue(localResponse());
      await expect(
        ai.analyzeLocal("message", undefined, ""),
      ).resolves.toMatchObject({ kind: "model" });
      expect(
        ai
          .getLocalDiagnostics()
          .filter((entry) => entry.operation === "setup")
          .map((entry) => entry.code),
      ).toEqual(["timeout", "ok"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels setup and suppresses progress and readiness from its late completion", async () => {
    const ai = await import("../src/ai");
    const controller = new AbortController();
    let finish!: () => void;
    let report!: (value: number) => void;
    let began!: () => void;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    fake.initializeDeviceModel.mockImplementation((callback) => {
      report = callback;
      began();
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const progress = vi.fn();
    const pending = ai.prepareLocal(progress, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({
      diagnostic: { code: "cancelled", outcome: "cancelled" },
    });
    await started;
    controller.abort();
    await rejected;
    report(1);
    finish();
    await Promise.resolve();
    expect(progress).not.toHaveBeenCalled();
    await expect(
      ai.analyzeLocal("message", undefined, ""),
    ).rejects.toMatchObject({ diagnostic: { code: "not_ready" } });
  });

  it.each(["comparison", "profile"])(
    "cancels %s, ignores late output, then recovers with a fresh request",
    async (operation) => {
      const ai = await import("../src/ai");
      await ai.prepareLocal(() => {});
      const controller = new AbortController();
      let finish!: (value: unknown) => void;
      let began!: () => void;
      const started = new Promise<void>((resolve) => {
        began = resolve;
      });
      fake.generateContent.mockImplementation(() => {
        began();
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      const invoke = (signal?: AbortSignal) =>
        operation === "comparison"
          ? ai.analyzeLocal("PRIVATE_CANARY", undefined, "", signal)
          : ai.summarizeProfile(["a", "b", "c", "d", "e"], signal);
      const pending = invoke(controller.signal);
      const rejected = expect(pending).rejects.toMatchObject({
        diagnostic: { operation, stage: "generation", code: "cancelled" },
      });
      await started;
      const failedSignal =
        fake.getGenerativeModel.mock.calls.at(-1)?.[1].onDeviceParams
          .createOptions.signal;
      controller.abort();
      await rejected;
      expect(failedSignal.aborted).toBe(true);
      const response = localResponse(
        operation === "comparison"
          ? interpretation()
          : { style: "Short casual English greetings." },
      );
      finish(response);
      await Promise.resolve();
      expect(
        ai
          .getLocalDiagnostics()
          .filter((entry) => entry.operation === operation),
      ).toHaveLength(1);
      fake.generateContent.mockResolvedValue(response);
      await invoke();
      const nextSignal =
        fake.getGenerativeModel.mock.calls.at(-1)?.[1].onDeviceParams
          .createOptions.signal;
      expect(nextSignal).not.toBe(failedSignal);
      expect(nextSignal.aborted).toBe(true);
      expect(ai.getLocalDiagnostics().at(-1)).toMatchObject({
        operation,
        code: "ok",
        outcome: "success",
      });
      expect(fake.generateContent).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(ai.getLocalDiagnostics())).not.toContain(
        "PRIVATE_CANARY",
      );
    },
  );

  it("does not start a generation for an already cancelled request", async () => {
    const ai = await import("../src/ai");
    await ai.prepareLocal(() => {});
    const controller = new AbortController();
    controller.abort();
    await expect(
      ai.analyzeLocal("message", undefined, "", controller.signal),
    ).rejects.toMatchObject({ diagnostic: { code: "cancelled" } });
    expect(fake.generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ["generation", "native_error"],
    ["execution_source", "wrong_execution_source"],
    ["parse", "invalid_json"],
    ["validation", "invalid_schema"],
  ])(
    "distinguishes %s failures and retains only redacted diagnostics",
    async (stage, code) => {
      const ai = await import("../src/ai");
      await ai.prepareLocal(() => {});
      if (stage === "generation")
        fake.generateContent.mockRejectedValue(new Error("PRIVATE_CANARY"));
      else
        fake.generateContent.mockResolvedValue({
          response: {
            inferenceSource:
              stage === "execution_source" ? "in_cloud" : "on_device",
            text: () =>
              stage === "parse"
                ? "PRIVATE_CANARY invalid JSON"
                : JSON.stringify({
                    ...interpretation(),
                    toneMatch: "PRIVATE_CANARY",
                  }),
          },
        });
      const error = await ai
        .analyzeLocal("PRIVATE_CANARY", undefined, "")
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(ai.LocalInferenceError);
      expect(error).toMatchObject({ diagnostic: { stage, code } });
      expect(JSON.stringify(error)).not.toContain("PRIVATE_CANARY");
      expect(String(error)).not.toContain("PRIVATE_CANARY");
      expect(ai.getLocalDiagnostics().at(-1)).toMatchObject({ stage, code });
      expect(fake.generateContent).toHaveBeenCalledTimes(1);
    },
  );

  it("uses supported fact evidence and forces unknown style matches without history", async () => {
    const ai = await import("../src/ai");
    await ai.prepareLocal(() => {});
    const output = interpretation({
      languageMatch: "consistent",
      toneMatch: "different",
      observations: ["An unsupported personal observation"],
    });
    output.facts.requestType = {
      value: "ordinary_money",
      quote: "Please send money",
    };
    output.facts.paymentChannel = {
      value: "gift_card",
      quote: "not in the message",
    };
    fake.generateContent.mockResolvedValue(localResponse(output));
    const result = await ai.analyzeLocal("Please send money", undefined, "");
    expect(result).toMatchObject({
      personal: { languageMatch: "unknown", toneMatch: "unknown", observations: [] },
      suggestedFeatures: {
        requestType: "ordinary_money",
        paymentChannel: "unknown",
      },
      evidence: [{ field: "requestType", quote: "Please send money" }],
      rejectedFields: ["paymentChannel"],
    });
    expect(ai.getLocalDiagnostics().at(-1)).toMatchObject({
      code: "ok",
      promptVersion: "2026-11-16.1",
    });
  });

  it.each([
    { style: "x".repeat(601) },
    { style: "Valid length writing summary.", privateExtra: "PRIVATE_CANARY" },
    { style: "   " },
  ])(
    "rejects invalid or oversized generated profiles before retention",
    async (value) => {
      const ai = await import("../src/ai");
      await ai.prepareLocal(() => {});
      fake.generateContent.mockResolvedValue(localResponse(value));
      await expect(
        ai.summarizeProfile(["a", "b", "c", "d", "e"]),
      ).rejects.toMatchObject({
        diagnostic: {
          operation: "profile",
          stage: "validation",
          code: "invalid_schema",
        },
      });
    },
  );
});
const localResponse = (value: unknown = interpretation()) => ({
  response: { inferenceSource: "on_device", text: () => JSON.stringify(value) },
});
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fake.apps.length = 0;
  fake.attested.clear();
  fake.services.clear();
  fake.initializeAppCheck.mockImplementation((app) => {
    fake.attested.add(app);
  });
  fake.getAI.mockImplementation((app) => {
    if (!fake.services.has(app))
      fake.services.set(app, { attested: fake.attested.has(app) });
    return fake.services.get(app);
  });
  for (const key of [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_RECAPTCHA_SITE_KEY",
  ])
    vi.stubEnv(key, "test-only");
  fake.getGenerativeModel.mockReturnValue(fake);
  fake.initializeDeviceModel.mockResolvedValue(undefined);
  vi.stubGlobal("LanguageModel", { availability: async () => "available" });
});
describe("SDK privacy routing (mocked transport)", () => {
  it.each(["local-first", "cloud-first"])(
    "attests the cloud service before its cached creation: %s",
    async (order) => {
      const ai = await import("../src/ai");
      fake.getGenerativeModel.mockImplementation((service, options) => ({
        initializeDeviceModel: fake.initializeDeviceModel,
        generateContent: async () => {
          if (options.mode === "only_in_cloud" && !service.attested)
            throw new Error("Unauthenticated cached AI service");
          return {
            response: {
              inferenceSource:
                options.mode === "only_in_cloud" ? "in_cloud" : "on_device",
              text: () =>
                options.mode === "only_in_cloud"
                  ? "Verify independently."
                  : JSON.stringify(interpretation()),
              candidates: [{ finishReason: "STOP" }],
            },
          };
        },
      }));
      const local = async () => {
        await ai.prepareLocal(() => {});
        await ai.analyzeLocal("synthetic", undefined, "");
      };
      const cloud = () =>
        ai.checkWorld(extractFeatures("send money"), () => {});
      if (order === "local-first") {
        await local();
        expect(fake.initializeAppCheck).not.toHaveBeenCalled();
        await cloud();
      } else {
        await cloud();
        await local();
      }
      expect(fake.apps.map((app) => app.name).sort()).toEqual([
        "hakiki-cloud",
        "hakiki-local",
      ]);
      expect(fake.initializeAppCheck).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["success", "invalid", "rejection", "timeout"])(
    "destroys the local session after %s",
    async (outcome) => {
      vi.useFakeTimers();
      try {
        const ai = await import("../src/ai");
        await ai.prepareLocal(() => {});
        if (outcome === "timeout")
          fake.generateContent.mockReturnValue(new Promise(() => {}));
        else if (outcome === "rejection")
          fake.generateContent.mockRejectedValue(new Error("Model failed"));
        else
          fake.generateContent.mockResolvedValue({
            response: {
              inferenceSource: "on_device",
              text: () =>
                outcome === "invalid"
                  ? "invalid JSON"
                  : JSON.stringify(interpretation()),
            },
          });
        const pending = ai.analyzeLocal("synthetic", undefined, "");
        const checked =
          outcome === "success"
            ? expect(pending).resolves.toMatchObject({ kind: "model" })
            : expect(pending).rejects.toThrow();
        if (outcome === "timeout") await vi.advanceTimersByTimeAsync(60000);
        await checked;
        const options = fake.getGenerativeModel.mock.calls.at(-1)?.[1];
        expect(options.mode).toBe("only_on_device");
        expect(options.onDeviceParams.createOptions.signal.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("bounds token preparation and ignores a late cloud completion", async () => {
    vi.useFakeTimers();
    try {
      const ai = await import("../src/ai");
      let finish!: (value: unknown) => void;
      fake.generateContent.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const receipts: unknown[] = [];
      const pending = ai.checkWorld(extractFeatures("send money"), (r) =>
        receipts.push(r),
      );
      const rejected = expect(pending).rejects.toThrow("could not finish");
      await vi.advanceTimersByTimeAsync(35000);
      await rejected;
      finish({
        response: {
          inferenceSource: "in_cloud",
          text: () => "Late response",
          candidates: [{ finishReason: "STOP" }],
        },
      });
      await Promise.resolve();
      expect(receipts).toHaveLength(2);
      expect(receipts.at(-1)).toMatchObject({ status: "failed" });
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects oversized complete cloud output instead of silently truncating it", async () => {
    const ai = await import("../src/ai");
    fake.generateContent.mockResolvedValue({
      response: {
        inferenceSource: "in_cloud",
        text: () => "x".repeat(6001),
        candidates: [{ finishReason: "STOP" }],
      },
    });
    const receipts: unknown[] = [];
    await expect(
      ai.checkWorld(extractFeatures("send money"), (r) => receipts.push(r)),
    ).rejects.toThrow("could not finish");
    expect(receipts.at(-1)).toMatchObject({ status: "failed" });
  });
  it("rejects truncated cloud output", async () => {
    const ai = await import("../src/ai");
    fake.generateContent.mockResolvedValue({
      response: {
        inferenceSource: "in_cloud",
        text: () => "An unfinished answer that",
        candidates: [{ finishReason: "MAX_TOKENS" }],
      },
    });
    const receipts: unknown[] = [];
    await expect(
      ai.checkWorld(extractFeatures("send money"), (r) => receipts.push(r)),
    ).rejects.toThrow("could not finish");
    expect(receipts.at(-1)).toMatchObject({ status: "failed" });
  });
  it("rejects empty cloud content instead of claiming completion", async () => {
    const ai = await import("../src/ai");
    fake.generateContent.mockResolvedValue({
      response: { inferenceSource: "in_cloud", text: () => "  " },
    });
    const receipts: unknown[] = [];
    await expect(
      ai.checkWorld(extractFeatures("send money"), (r) => receipts.push(r)),
    ).rejects.toThrow("could not finish");
    expect(receipts.at(-1)).toMatchObject({ status: "failed" });
  });
  it("forces local-only mode and rejects a cloud-located personal result", async () => {
    const ai = await import("../src/ai");
    await ai.prepareLocal(() => {});
    expect(fake.getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: "only_on_device" }),
    );
    fake.generateContent.mockResolvedValue({
      response: { inferenceSource: "in_cloud", text: () => "{}" },
    });
    await expect(
      ai.analyzeLocal("private raw text", sampleProfile, ""),
    ).rejects.toThrow("execution location");
    expect(
      fake.getGenerativeModel.mock.calls.every(
        (call) => call[1].mode === "only_on_device",
      ),
    ).toBe(true);
  });
  it("does not call any generation endpoint when a category includes raw text", async () => {
    const ai = await import("../src/ai");
    await expect(
      ai.checkWorld(
        { ...extractFeatures("send money"), message: "secret" } as never,
        () => {},
      ),
    ).rejects.toThrow();
    expect(fake.generateContent).not.toHaveBeenCalled();
  });
  it("records the exact approved SDK content and completed execution location", async () => {
    const ai = await import("../src/ai");
    fake.generateContent.mockResolvedValue({
      response: {
        inferenceSource: "in_cloud",
        text: () => "Check independently.",
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "javascript:alert(1)", title: "bad" } },
                { web: { uri: "https://consumer.ftc.gov/", title: "FTC" } },
              ],
            },
          },
        ],
      },
    });
    const receipts: unknown[] = [];
    const result = await ai.checkWorld(
      extractFeatures("CANARY send money now"),
      (r) => receipts.push(r),
    );
    expect(result.sources).toHaveLength(1);
    expect(fake.getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: "only_in_cloud" }),
    );
    expect(JSON.stringify(fake.generateContent.mock.calls)).not.toContain(
      "CANARY",
    );
    expect(receipts).toHaveLength(2);
    expect(receipts[1]).toMatchObject({
      status: "completed",
      request: fake.generateContent.mock.calls[0][0],
    });
  });
  it("keeps a failure receipt and never retries with the raw text", async () => {
    const ai = await import("../src/ai");
    fake.generateContent.mockRejectedValue(new Error("429"));
    const receipts: unknown[] = [];
    await expect(
      ai.checkWorld(extractFeatures("CANARY secret"), (r) => receipts.push(r)),
    ).rejects.toThrow("could not finish");
    expect(receipts.at(-1)).toMatchObject({ status: "failed" });
    expect(fake.generateContent).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed local observations without a cloud fallback", async () => {
    const ai = await import("../src/ai");
    await ai.prepareLocal(() => {});
    fake.generateContent.mockResolvedValue({
      response: {
        inferenceSource: "on_device",
        text: () => '{"toneMatch":"safe"}',
      },
    });
    await expect(
      ai.analyzeLocal("secret", sampleProfile, ""),
    ).rejects.toThrow();
    expect(
      fake.getGenerativeModel.mock.calls.every(
        (call) => call[1].mode === "only_on_device",
      ),
    ).toBe(true);
  });
});
