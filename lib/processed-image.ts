export const MAX_PROCESSED_BYTES = 8 * 1024 * 1024;

export type ProcessedImage = { bytes: Uint8Array; mime: "image/png" | "image/jpeg"; ext: "png" | "jpg" };

function sniff(b: Uint8Array): ProcessedImage["mime"] | null {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/**
 * Decode the model's base64 image (raw base64 or a data URL) into bytes.
 * Returns null instead of throwing on anything we can't trust, so a bad image never loses a ballot.
 * The type comes from the file's magic bytes; the declared mime is only a fallback check.
 */
export function decodeProcessedImage(input: string | null | undefined): ProcessedImage | null {
  if (!input) return null;
  const comma = input.startsWith("data:") ? input.indexOf(",") : -1;
  const b64 = (comma >= 0 ? input.slice(comma + 1) : input).replace(/\s+/g, "");
  if (!b64 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(b64)) return null;
  // Rough pre-check so we don't allocate a huge buffer.
  if ((b64.length * 3) / 4 > MAX_PROCESSED_BYTES) return null;
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  const mime = sniff(bytes);
  if (!mime) return null;
  return { bytes, mime, ext: mime === "image/png" ? "png" : "jpg" };
}
