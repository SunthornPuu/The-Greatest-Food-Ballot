import { describe, expect, it } from "vitest";
import { decodeProcessedImage } from "@/lib/processed-image";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 1, 2]).toString("base64");

describe("decodeProcessedImage", () => {
  it("decodes raw base64 PNG", () => {
    expect(decodeProcessedImage(png)).toMatchObject({ mime: "image/png", ext: "png" });
  });
  it("decodes a data URL and sniffs JPEG even if the URL lies", () => {
    const r = decodeProcessedImage(`data:image/png;base64,${jpg}`);
    expect(r).toMatchObject({ mime: "image/jpeg", ext: "jpg" });
    expect(r?.bytes[0]).toBe(0xff);
  });
  it("tolerates whitespace/newlines in base64", () => {
    expect(decodeProcessedImage(png.replace(/(.{4})/g, "$1\n"))?.mime).toBe("image/png");
  });
  it("returns null for garbage, empty and non-images", () => {
    expect(decodeProcessedImage(undefined)).toBeNull();
    expect(decodeProcessedImage("")).toBeNull();
    expect(decodeProcessedImage("not base64 at all!!")).toBeNull();
    expect(decodeProcessedImage(Buffer.from("hello world").toString("base64"))).toBeNull();
  });
});
