import { describe, expect, it } from "vitest";
import { BALLOT, markBox } from "@/lib/ballot-geometry";
import { jpegSize } from "@/lib/jpeg";
import { verdict } from "@/lib/verdict";
import { ticket } from "@/lib/ticket";
import { readFileSync } from "node:fs";

describe("ballot", () => {
  it("ballot.jpg is native 2400×2880", () => {
    expect(jpegSize(readFileSync("public/ballot.jpg"))).toEqual(BALLOT);
  });
  it("mark boxes sit inside the ballot and don't overlap rows", () => {
    for (let c = 0; c <= 26; c++) {
      const b = markBox(c)!;
      expect(b.x + b.w).toBeLessThanOrEqual(BALLOT.width);
      expect(b.y + b.h).toBeLessThanOrEqual(BALLOT.height);
    }
    expect(markBox(2)!.y).toBeGreaterThan(markBox(1)!.y + markBox(1)!.h);
    expect(markBox(14)!.y).toBe(markBox(1)!.y);
    expect(markBox(-1)).toBeNull();
    expect(markBox(27)).toBeNull();
  });
  it("verdict labels", () => {
    expect(verdict(5).label).toBe("Voted for Green Curry");
    expect(verdict(5).stamp).toBe("VOTED · #5 GREEN CURRY");
    expect(verdict(0).label).toBe("Abstained");
    expect(verdict(-1).label).toBe("Spoiled ballot");
    expect(ticket("a3f9c0de-0000")).toBe("#A3F9");
  });
});
