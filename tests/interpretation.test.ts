import { describe,it,expect } from "vitest";
import { parseInterpretation, interpretationPrompt } from "../src/interpretation";
const output = () => ({
  languageMatch:"unknown",toneMatch:"unknown",observations:[],
  facts:{requestType:{value:"ordinary_money",quote:"send money"},paymentChannel:{value:"bank_transfer",quote:"bank"},urgency:{value:"not_stated",quote:""},secrecyRequested:{value:null,quote:""},changedContactClaim:{value:null,quote:""},verificationDiscouraged:{value:false,quote:"call first"}},
});
describe("local evidence boundary",()=>{
  it("keeps supported categories and direct quotes separate from cloud features",()=>{
    const result=parseInterpretation(output(),"Please send money by bank; call first.");
    expect(result.features.requestType).toBe("ordinary_money");
    expect(result.features.verificationDiscouraged).toBe(false);
    expect(result.evidence).toHaveLength(3);
    expect(JSON.stringify(result.features)).not.toContain("call first");
  });
  it("downgrades unsupported positive and negative assertions without inventing evidence",()=>{
    const result=parseInterpretation(output(),"Hello there");
    expect(result.features.requestType).toBe("unknown");
    expect(result.features.paymentChannel).toBe("unknown");
    expect(result.features.verificationDiscouraged).toBeNull();
    expect(result.rejectedFields).toHaveLength(3);
  });
  it("rejects extra personal data and invented enum fields",()=>{
    expect(()=>parseInterpretation({...output(),identity:"safe"},"send money")).toThrow();
    const value=output();value.facts.paymentChannel.value="safe";
    expect(()=>parseInterpretation(value,"send money")).toThrow();
  });
  it("does not accept evidence beyond the bounded input",()=>{
    expect(parseInterpretation(output(),"x".repeat(4000)+"send money bank call first").evidence).toHaveLength(0);
    expect(interpretationPrompt("x".repeat(4000)+"SECRET")).not.toContain("SECRET");
  });
});
