export type LocalOperation =
  "availability" | "setup" | "comparison" | "profile";
export type LocalStage =
  | "availability"
  | "initialization"
  | "generation"
  | "execution_source"
  | "parse"
  | "validation";
export type LocalFailureCode =
  | "unavailable"
  | "not_ready"
  | "insufficient_history"
  | "timeout"
  | "cancelled"
  | "unsupported"
  | "input_limit"
  | "invalid_state"
  | "native_error"
  | "wrong_execution_source"
  | "invalid_json"
  | "invalid_schema";
export type LocalDiagnostic = Readonly<{
  id: number;
  at: string;
  operation: LocalOperation;
  stage: LocalStage;
  outcome: "success" | "failure" | "cancelled";
  code: LocalFailureCode | "ok";
  elapsedMs: number;
  stageElapsedMs: number;
  promptVersion: string;
  retryable: boolean;
}>;

const messages: Record<LocalFailureCode, string> = {
  unavailable:
    "On-device AI is unavailable in this browser. You can use the text-rule check.",
  not_ready: "Enable on-device AI first.",
  insufficient_history:
    "At least five nonempty messages from this person are needed. You can still check a request without history.",
  timeout:
    "The on-device operation took too long. Use the text-rule check or try again.",
  cancelled:
    "The on-device operation was cancelled. No raw text was sent to the cloud.",
  unsupported:
    "This device does not support the requested on-device operation.",
  input_limit:
    "This input exceeds the on-device model's capacity. Try a shorter input.",
  invalid_state:
    "The on-device model is not ready for this request. Check device setup and try again.",
  native_error:
    "The on-device model could not finish. Use the text-rule check or try again.",
  wrong_execution_source:
    "The local execution location could not be verified. Personal comparison is unavailable.",
  invalid_json:
    "The on-device model returned an unreadable response. Personal comparison is unavailable.",
  invalid_schema:
    "The on-device response did not match the required format. Personal comparison is unavailable.",
};

// Neither class retains a native cause, stack, message, or model-output payload.
export class LocalFailure extends Error {
  constructor(readonly code: LocalFailureCode) {
    super(messages[code]);
    this.name = "LocalFailure";
  }
}
export class LocalInferenceError extends Error {
  constructor(readonly diagnostic: LocalDiagnostic) {
    super(messages[diagnostic.code as LocalFailureCode]);
    this.name = "LocalInferenceError";
  }
}

const history: LocalDiagnostic[] = [];
let nextId = 0;
export function getLocalDiagnostics(): LocalDiagnostic[] {
  return history.map((entry) => ({ ...entry }));
}

function classify(error: unknown, stage: LocalStage): LocalFailureCode {
  if (error instanceof LocalFailure) return error.code;
  if (stage === "parse") return "invalid_json";
  if (stage === "validation") return "invalid_schema";
  // Only fixed names/codes are used. Unknown error strings never enter diagnostics.
  const candidate =
    error && typeof error === "object"
      ? (error as { name?: unknown; code?: unknown })
      : {};
  if (candidate.name === "AbortError") return "cancelled";
  if (
    candidate.name === "NotSupportedError" ||
    candidate.code === "ai/unsupported"
  )
    return "unsupported";
  if (candidate.name === "QuotaExceededError") return "input_limit";
  if (candidate.name === "InvalidStateError") return "invalid_state";
  if (candidate.code === "ai/api-not-enabled") return "unavailable";
  return "native_error";
}

export async function diagnoseLocal<T>(
  operation: LocalOperation,
  promptVersion: string,
  initialStage: LocalStage,
  work: (setStage: (stage: LocalStage) => void) => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const id = ++nextId;
  let stage = initialStage;
  let stageStarted = started;
  const record = (code: LocalDiagnostic["code"]): LocalDiagnostic => {
    const now = performance.now();
    const entry = Object.freeze({
      id,
      at: new Date().toISOString(),
      operation,
      stage,
      outcome:
        code === "ok"
          ? "success"
          : code === "cancelled"
            ? "cancelled"
            : "failure",
      code,
      elapsedMs: Math.max(0, Math.round(now - started)),
      stageElapsedMs: Math.max(0, Math.round(now - stageStarted)),
      promptVersion,
      retryable: [
        "timeout",
        "cancelled",
        "invalid_state",
        "native_error",
        "invalid_json",
        "invalid_schema",
      ].includes(code),
    } satisfies LocalDiagnostic);
    history.push(entry);
    if (history.length > 200) history.shift();
    return entry;
  };
  try {
    const result = await work((next) => {
      stage = next;
      stageStarted = performance.now();
    });
    record("ok");
    return result;
  } catch (error) {
    throw new LocalInferenceError(record(classify(error, stage)));
  }
}
