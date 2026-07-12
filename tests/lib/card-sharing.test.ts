import { describe, expect, it } from "vitest";
import { formatComplimentForPlatform, type ComplimentShareData } from "@/lib/card-sharing";

const card: ComplimentShareData = {
  text: "You guide customer conversations like a moonlit orchestra, and 94 percent of support tickets now line up politely for your Customer Success Manager wisdom.",
  jobFunction: "Customer Success Manager",
  personaName: "Ancient Oracle",
  bucket: "mythic",
  dramaLevel: 1,
  deliveryMode: "direct",
};

describe("platform compliment formatting", () => {
  it("keeps X copy within 280 characters", () => {
    const output = formatComplimentForPlatform("x", card);
    expect(output.length).toBeLessThanOrEqual(280);
    expect(output).toContain("#HypeForge");
  });

  it("truncates unusually long X copy at a word boundary", () => {
    const output = formatComplimentForPlatform("x", { ...card, text: "professional excellence ".repeat(40) });
    expect(output.length).toBeLessThanOrEqual(280);
    expect(output).toContain("…\n\n#HypeForge");
  });

  it("formats LinkedIn copy with spacing and workplace tags", () => {
    const output = formatComplimentForPlatform("linkedin", card);
    expect(output).toContain("A little appreciation for Customer Success Manager:");
    expect(output).toContain("\n\n");
    expect(output).toContain("#EmployeeRecognition #WorkplaceCulture");
  });

  it("formats WhatsApp copy with lightweight emphasis", () => {
    const output = formatComplimentForPlatform("whatsapp", card);
    expect(output).toContain("*A HypeForge compliment for Customer Success Manager*");
    expect(output).toContain("_Made with HypeForge_");
  });
});
