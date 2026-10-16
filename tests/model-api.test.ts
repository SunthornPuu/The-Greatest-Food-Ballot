import { describe, expect, it } from "vitest";
import { ModelError, toPredictResult } from "@/lib/model-api";
import { decodeProcessedImage } from "@/lib/processed-image";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64");

// Shape copied from the pipeline README (POST /evaluate).
const readmeExample = {
  output: 25,
  analysis: {
    verdict: "valid",
    verdict_th: "บัตรดี",
    reason: "single valid cross in box #25",
    marks: [
      { kind: "candidate_box", number: 25, number_source: "printed", label: "VALID",
        reason: "single cross inside box", confidence: 0.95, bbox: [829, 689, 184, 113] },
    ],
    boxes_detected: 7,
    warnings: [],
    image: png,
  },
};

describe("toPredictResult", () => {
  it("maps the README example", () => {
    const r = toPredictResult(readmeExample);
    expect(r.prediction).toBe(25);
    expect(r.confidence).toBe(0.95);
    expect(r.analysis).toMatchObject({ verdict: "valid", reason: "single valid cross in box #25" });
    expect(r.analysis).not.toHaveProperty("image");
    expect(decodeProcessedImage(r.processed_image)?.mime).toBe("image/png");
  });
  it("spoiled ballots have no single confidence", () => {
    expect(toPredictResult({ output: -1, analysis: { marks: [] } }).confidence).toBeNull();
  });
  it("abstain takes the no-vote box confidence", () => {
    const r = toPredictResult({
      output: 0,
      analysis: { marks: [{ kind: "no_vote_box", number: null, label: "VALID", confidence: 0.8 }] },
    });
    expect(r.confidence).toBe(0.8);
  });
  it("keeps unknown new fields (additive API)", () => {
    const r = toPredictResult({ output: 3, analysis: { new_field: 1 } });
    expect(r.analysis).toHaveProperty("new_field", 1);
  });
  it("out-of-range or missing output is a model error, not a spoiled ballot", () => {
    expect(() => toPredictResult({ output: 501, analysis: {} })).toThrow(ModelError);
    expect(() => toPredictResult({ analysis: {} })).toThrow(ModelError);
    expect(() => toPredictResult(null)).toThrow(ModelError);
  });
});
