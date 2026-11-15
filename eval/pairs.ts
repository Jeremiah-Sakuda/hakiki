// Paired pilot v1. Authored synthetic fixtures, NOT a blind benchmark or model results.
// Each family is assigned to one split; linguistic independence is not established.
type Family = {
  id: string;
  split: "development" | "evaluation";
  history: string[];
  genuine: string;
  imposter: string;
};
const families: Family[] = [
  {
    id: "dev-brief",
    split: "development",
    history: [
      "hey cuz, got home.",
      "thanks for lunch cuz.",
      "call tonight?",
      "no rush on the tickets.",
      "hey cuz, mum says hi.",
    ],
    genuine: "hey cuz, can you cover lunch? call me first, no rush.",
    imposter: "URGENT: transfer funds immediately and do not telephone.",
  },
  {
    id: "dev-formal",
    split: "development",
    history: [
      "Good evening. Thank you for your help.",
      "Please telephone when convenient.",
      "I received your note, thank you.",
      "We can review the receipt together.",
      "Kind regards and see you soon.",
    ],
    genuine: "Good evening. Could we discuss the school invoice by telephone?",
    imposter: "yo quick send it now lol no calls",
  },
  {
    id: "eval-punctuated",
    split: "evaluation",
    history: [
      "Hello! Home at last!",
      "Lovely to see you!",
      "Coffee tomorrow? Let me know!",
      "Thanks again! I will call later!",
      "What a lovely day!",
    ],
    genuine:
      "Hello! I lost my phone! Can you call the house before sending the fare?",
    imposter: "Hello! Lovely day! Could you cover the fare? I will call later!",
  },
  {
    id: "eval-lowercase",
    split: "evaluation",
    history: [
      "morning. just leaving.",
      "back soon. kettle is on.",
      "thanks. see you at six.",
      "all good. ring tomorrow.",
      "yep. we can discuss it.",
    ],
    genuine:
      "I AM AT THE HOSPITAL. Please call the number you already have before paying.",
    imposter: "morning. need the rent. all good. send it when you can.",
  },
  {
    id: "eval-emoji",
    split: "evaluation",
    history: [
      "See you soon 🙂",
      "Lunch was lovely 🙂",
      "Thanks for helping 🙏",
      "Call me after work 🙂",
      "We can sort the tickets together 🙏",
    ],
    genuine: "Could you cover my ticket after we talk? Thanks 🙏",
    imposter: "I need gift cards immediately. Keep the codes between us.",
  },
  {
    id: "eval-detail",
    split: "evaluation",
    history: [
      "The meeting ends at four; I can call afterwards.",
      "I checked the receipt and the total includes delivery.",
      "Before we book, let us confirm the dates together.",
      "I will bring the form so we can read it together.",
      "Please wait until we have compared the two quotes.",
    ],
    genuine:
      "My bank card stopped working; let us speak on the usual number before you cover the invoice.",
    imposter:
      "Before we pay, let us confirm the total together. I need help with the invoice.",
  },
];
export const pairedCases = families.flatMap((f) => {
  const sameSplit = families.filter((x) => x.split === f.split);
  const wrong = sameSplit[(sameSplit.indexOf(f) + 1) % sameSplit.length];
  return (["genuine", "imposter"] as const).map((label) => ({
    id: `${f.id}-${label}`,
    source: "synthetic" as const,
    language: "en" as const,
    split: f.split,
    templateFamilyId: f.id,
    contactId: f.id,
    history: f.history,
    text: f[label],
    label,
    labelRationale:
      label === "genuine"
        ? "Author-defined scenario: the real contact wrote this, including possible stress-related style changes."
        : "Author-defined scenario: an imposter wrote this; matching style can be intentional.",
    metadata: { senderNumberAvailable: false, trustedNumberAvailable: false },
    variants: {
      matched: f.history,
      omitted: null,
      wrongContact: wrong.history,
    },
    wrongContactId: wrong.id,
  }));
});
