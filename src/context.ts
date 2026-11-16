import { z } from "zod";
import type { Features } from "./domain";

export const paymentMethods = [
  "mobile_money",
  "bank_transfer",
  "gift_card",
  "crypto",
] as const;
export const paymentLabels: Record<(typeof paymentMethods)[number], string> = {
  mobile_money: "mobile money",
  bank_transfer: "bank transfer",
  gift_card: "gift cards",
  crypto: "cryptocurrency",
};
export const contextSchema = z.strictObject({
  moneyRequests: z.enum(["unknown", "no_message_requests_confirmed"]),
  usualPaymentMethods: z.array(z.enum(paymentMethods)).max(4),
  verificationAgreement: z.enum(["unknown", "speak_before_sending"]),
  confirmedAt: z.iso.datetime().nullable(),
  source: z.literal("user_confirmed"),
});
export type ContactContext = z.infer<typeof contextSchema>;
export function emptyContext(): ContactContext {
  return {
    moneyRequests: "unknown",
    usualPaymentMethods: [],
    verificationAgreement: "unknown",
    confirmedAt: null,
    source: "user_confirmed",
  };
}
export type ContextObservation = {
  code:
    | "no_message_requests"
    | "different_payment_method"
    | "verification_discouraged"
    | "verification_step"
    | "request_unknown"
    | "payment_unknown"
    | "no_confirmed_context";
  kind: "departure" | "reminder" | "unavailable";
  text: string;
  action: string;
};
export function compareContext(
  features: Features,
  context?: ContactContext,
): ContextObservation[] {
  const parsed = contextSchema.safeParse(context);
  if (
    !parsed.success ||
    !parsed.data.confirmedAt ||
    (parsed.data.moneyRequests === "unknown" &&
      !parsed.data.usualPaymentMethods.length &&
      parsed.data.verificationAgreement === "unknown")
  )
    return [
      {
        code: "no_confirmed_context",
        kind: "unavailable",
        text: "No confirmed arrangements are saved for this person.",
        action: "Use a contact route you trusted before this message.",
      },
    ];
  const c = parsed.data;
  const observations: ContextObservation[] = [];
  const moneyRequested = features.requestType !== "unknown";
  if (!moneyRequested)
    observations.push({
      code: "request_unknown",
      kind: "unavailable",
      text: "A money request has not been established in this interpretation.",
      action: "Review the Request category before comparing arrangements.",
    });
  if (moneyRequested && c.moneyRequests === "no_message_requests_confirmed")
    observations.push({
      code: "no_message_requests",
      kind: "departure",
      text: "This appears to ask for money. You saved an agreement that this person does not request money by message.",
      action:
        "Check through your previously trusted route. Their circumstances may have changed.",
    });
  if (moneyRequested && c.usualPaymentMethods.length) {
    if (features.paymentChannel === "unknown")
      observations.push({
        code: "payment_unknown",
        kind: "unavailable",
        text: "The payment method is not known, so it cannot be compared with your usual methods.",
        action: "Clarify the method through a trusted route.",
      });
    else if (!c.usualPaymentMethods.includes(features.paymentChannel))
      observations.push({
        code: "different_payment_method",
        kind: "departure",
        text: `This asks for ${paymentLabels[features.paymentChannel]}. You saved ${c.usualPaymentMethods.map((p) => paymentLabels[p]).join(", ")} as your usual method${c.usualPaymentMethods.length > 1 ? "s" : ""}.`,
        action:
          "Discuss the change directly. A genuine request can use a different method.",
      });
  }
  if (c.verificationAgreement === "speak_before_sending") {
    observations.push(
      moneyRequested && features.verificationDiscouraged === true
        ? {
            code: "verification_discouraged",
            kind: "departure",
            text: "This request discourages a conversation, while your saved agreement is to speak before sending.",
            action: "Pause and use your independently saved contact route.",
          }
        : {
            code: "verification_step",
            kind: "reminder",
            text: "Your saved agreement is to speak through a trusted route before sending.",
            action:
              "Follow that step if you decide to send. Missing mention of a call is not a broken agreement.",
          },
    );
  }
  if (!observations.length)
    observations.push({
      code: "verification_step",
      kind: "reminder",
      text: "No departure from the saved arrangements was identified in these categories. This does not establish identity.",
      action: "Confirm the request through a route you already trust.",
    });
  return observations;
}
