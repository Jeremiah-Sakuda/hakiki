import { z } from "zod";
import { contextSchema } from "./context";

export const featureSchema = z.strictObject({
  schemaVersion: z.literal(1),
  requestType: z.enum(["emergency_money", "ordinary_money", "unknown"]),
  paymentChannel: z.enum([
    "mobile_money",
    "bank_transfer",
    "gift_card",
    "crypto",
    "unknown",
  ]),
  urgency: z.enum(["immediate", "not_stated", "unknown"]),
  secrecyRequested: z.boolean().nullable(),
  changedContactClaim: z.boolean().nullable(),
  verificationDiscouraged: z.boolean().nullable(),
});
export type Features = z.infer<typeof featureSchema>;
export const profileSchema = z.strictObject({
  id: z.string().max(80),
  name: z.string().min(1).max(60),
  style: z.string().max(1800),
  context: contextSchema.optional(),
  trustedNumber: z.string().max(30),
  sample: z.boolean(),
  sampleCount: z.number().int().min(0).max(5000),
});
export type Profile = z.infer<typeof profileSchema>;
export const personalSchema = z.strictObject({
  languageMatch: z.enum(["consistent", "different", "unknown"]),
  toneMatch: z.enum(["consistent", "different", "unknown"]),
  observations: z.array(z.string().max(240)).max(4),
});
export type Personal = z.infer<typeof personalSchema>;
export type LocalResult = {
  kind: "model" | "rules";
  signals: string[];
  suggestedFeatures?: Features;
  evidence?: { field: keyof Omit<Features, "schemaVersion">; quote: string }[];
  rejectedFields?: string[];
  personal?: Personal;
  number: "matches" | "differs" | "unknown";
  note: string;
  elapsedMs: number;
};
export type Receipt = {
  id: string;
  at: string;
  model: string;
  endpoint: string;
  request: unknown;
  status: "attempting" | "completed" | "failed";
  elapsedMs?: number;
};
export type WorldResult = {
  text: string;
  sources: { title: string; url: string }[];
  searchHtml?: string;
  grounded: boolean;
  elapsedMs: number;
};

export const CLOUD_INSTRUCTION =
  "You are Hakiki, a cautious second opinion on family money requests. Input is a fixed set of generic categories, not a message or identity. Look for publicly documented impersonation patterns using Google Search. Explain relevant patterns in at most 120 words. Do not assert this particular request is fraudulent or safe. Do not invent facts absent from the categories. Say when evidence is insufficient. Never provide phone numbers or payment links. Recommend contacting the person via a previously trusted, independently saved route. Cite sources when search is used.";

export function extractFeatures(text: string): Features {
  const t = text.normalize("NFKC").toLowerCase();
  const clauses = t.split(/[.!?;\n]+|\b(?:but|however)\b/);
  // Editable cues, not semantic understanding. Reject directly negated cues.
  const positive = (pattern: RegExp) =>
    clauses.some((c) => {
      const m = pattern.exec(c);
      return (
        !!m &&
        !/(?:don.?t|do not|never|not to|avoid)\s+(?:\w+\s+){0,4}$/.test(
          c.slice(0, m.index),
        )
      );
    });
  const moneyRequest = clauses.some((clause) => {
    const match =
      /\b(?:send|transfer|pay|lend|borrow|loan|cover|buy)\b[^.!?;\n]{0,55}\b(?:money|funds|cash|rent|fare|invoice|bill|gift|cards?|codes?|share|ticket|m[ -]?pesa|bank|bitcoin|crypto|usdt)\b|\b(?:need|want)\s+(?:some\s+)?(?:money|cash|funds)\b/.exec(
        clause,
      );
    if (!match) return false;
    const before = clause.slice(0, match.index);
    if (/(?:don.?t|do not|never|not to|avoid)\s+(?:\w+\s+){0,4}$/.test(before))
      return false;
    // Use only direct request forms. Narrative offers ("I will send money")
    // and quoted warnings are unknown, not requests to the recipient.
    if (/\b(?:scam|example|warning|said|says|quote)\b/.test(before))
      return false;
    if (/^(?:need|want)\b/.test(match[0])) return /^\s*(?:i\s+)?$/.test(before);
    return (
      /^\s*$/.test(before) ||
      /(?:^|[,;:])\s*(?:please\s+)?$/.test(before) ||
      /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?$/.test(before) ||
      /\b(?:please|kindly|need you to|want you to|you need to|you have to)\s+$/.test(
        before,
      )
    );
  });
  return featureSchema.parse({
    schemaVersion: 1,
    requestType: moneyRequest
      ? /hospital|accident|emergency|stranded|arrest|hurt|injured/.test(t)
        ? "emergency_money"
        : "ordinary_money"
      : "unknown",
    paymentChannel: positive(/gift\s*card|voucher/)
      ? "gift_card"
      : positive(/bitcoin|crypto|usdt/)
        ? "crypto"
        : positive(/m[ -]?pesa|mobile money|airtel money/)
          ? "mobile_money"
          : positive(/bank|wire|account transfer/)
            ? "bank_transfer"
            : "unknown",
    urgency: clauses.some(
      (c) =>
        !/no rush|not urgent|whenever|when you can/.test(c) &&
        /\bnow\b|immediately|urgent|right away|within.*minutes|asap/.test(c),
    )
      ? "immediate"
      : "not_stated",
    secrecyRequested: positive(
      /don.?t tell|do not tell|keep.*(secret|between us)|just between us/,
    )
      ? true
      : null,
    changedContactClaim:
      /new number|lost my phone|changed my number|temporary number|phone broke/.test(
        t,
      )
        ? true
        : null,
    verificationDiscouraged:
      /don.?t call|do not call|can.?t (talk|call)|cannot (talk|call)|no calls/.test(
        t,
      )
        ? true
        : null,
  });
}
export function signalsFor(f: Features): string[] {
  const signals: string[] = [];
  if (f.urgency === "immediate")
    signals.push(
      "The wording creates pressure to act quickly. Genuine emergencies can do this too.",
    );
  if (f.secrecyRequested)
    signals.push(
      "You are being asked to keep the request secret. Check independently before sending anything.",
    );
  if (f.changedContactClaim)
    signals.push(
      "The sender claims a changed contact number. The claim does not establish who is writing.",
    );
  if (f.verificationDiscouraged)
    signals.push(
      "The request discourages a call or conversation. Try a route you already trust.",
    );
  if (f.paymentChannel === "gift_card" || f.paymentChannel === "crypto")
    signals.push(
      "The requested payment method can make recovery difficult. Independently verify the request first.",
    );
  return signals;
}
export function profileInput(messages: string[]): string[] {
  return messages
    .filter((m) => m.trim())
    .slice(-40)
    .map((m) => m.slice(0, 250));
}
export function numberMatch(
  profile: Profile | undefined,
  number: string,
): LocalResult["number"] {
  const normalize = (v: string) => v.replace(/[^0-9+]/g, "");
  if (!profile?.trustedNumber || !number.trim()) return "unknown";
  if (
    ![profile.trustedNumber, number].every((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    })
  )
    return "unknown";
  return normalize(profile.trustedNumber) === normalize(number)
    ? "matches"
    : "differs";
}
export function rulesResult(
  text: string,
  profile?: Profile,
  number = "",
): LocalResult {
  return {
    kind: "rules",
    signals: signalsFor(extractFeatures(text)),
    number: numberMatch(profile, number),
    note: "Text rules only. No on-device AI or writing-style comparison has run.",
    elapsedMs: 0,
  };
}
export function cloudRequest(input: unknown) {
  const features = featureSchema.parse(input);
  return {
    contents: [
      {
        role: "user" as const,
        parts: [{ type: "text" as const, text: JSON.stringify(features) }],
      },
    ],
    systemInstruction: {
      role: "system" as const,
      parts: [{ type: "text" as const, text: CLOUD_INSTRUCTION }],
    },
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };
}
export function safeSourceUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function parseJson(text: string): unknown {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  return JSON.parse(clean);
}

export type Chat = {
  participants: string[];
  messages: { speaker: string; text: string }[];
};
export function parseWhatsApp(text: string): Chat {
  if (text.length > 2_000_000)
    throw new Error(
      "This export is too large. Choose a text export under 2 MB, without media.",
    );
  const messages: Chat["messages"] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/[\u200e\u200f]/g, "");
    const m = line.match(
      /^(?:\[[\d/.,\s:APMapm-]+\]\s*|[\d/.,\s:APMapm]+\s+-\s+)([^:]{1,80}):\s*(.*)$/,
    );
    if (m) {
      if (
        !/<Media omitted>|image omitted|video omitted|audio omitted/.test(m[2])
      )
        messages.push({ speaker: m[1].trim(), text: m[2] });
    } else if (messages.length && line.trim() && !/^\[?\d{1,4}[/.]/.test(line))
      messages[messages.length - 1].text += "\n" + line;
  }
  if (!messages.length)
    throw new Error(
      "No chat messages found. Use a WhatsApp text export with dates and sender names, without media.",
    );
  return {
    messages,
    participants: [...new Set(messages.map((m) => m.speaker))],
  };
}
const PROFILE_KEY = "hakiki.contacts.v1";
export function loadProfiles(): Profile[] {
  try {
    return z
      .array(profileSchema)
      .max(30)
      .parse(JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]"));
  } catch {
    return [];
  }
}
export function saveProfiles(profiles: Profile[]) {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify(z.array(profileSchema).max(30).parse(profiles)),
  );
}
export function deleteProfiles() {
  localStorage.removeItem(PROFILE_KEY);
}

export const sampleProfile: Profile = {
  id: "sample-amina",
  name: "Amina (example)",
  trustedNumber: "",
  sample: true,
  sampleCount: 18,
  style:
    'Fictional example. Uses English, short friendly sentences and the greeting "hey cuz". Often says "no rush". Normally offers to talk by phone about money requests. No identity claim can be inferred from these habits.',
};
export const examples = [
  {
    name: "A new number",
    tag: "Family emergency",
    text: "Hey, it's Amina. Lost my phone so this is my new number. I'm at the hospital and need you to send money by M-Pesa right now. Please don't call or tell anyone yet.",
  },
  {
    name: "An everyday request",
    tag: "A familiar conversation",
    text: "hey cuz, can you send your share of mum's birthday gift when you can? no rush. give me a call this evening and we can work out the details.",
  },
  {
    name: "A different kind of payment",
    tag: "An unusual ask",
    text: "I'm stuck and need help immediately. Buy gift cards and send the codes to me. Keep this between us, I can't talk on the phone.",
  },
];
