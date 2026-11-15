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
                  : JSON.stringify({
                      languageMatch: "unknown",
                      toneMatch: "unknown",
                      observations: [],
                    }),
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
                  : JSON.stringify({
                      languageMatch: "unknown",
                      toneMatch: "unknown",
                      observations: [],
                    }),
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
