/**
 * Perf fix (audit finding #5 / Top 10): every property image URL returned
 * by the API is already a Cloudinary `secure_url` (see
 * CloudinaryImageStorageService) capped at a single upload-time master
 * resolution (2000x2000) with no delivery-time transform ever applied --
 * a 76px gallery thumbnail and the full detail hero downloaded the exact
 * same file. Cloudinary supports inserting a delivery-time transformation
 * segment directly into the existing URL path (right after `/upload/`),
 * so this is a pure string transform on data the API already returns --
 * no backend, database, or API contract change required.
 *
 * URLs that don't contain the expected Cloudinary `/upload/` delivery
 * marker (e.g. local dev fixtures, or any future non-Cloudinary image
 * source) are returned unchanged rather than mangled, so this fails safe.
 */

const CLOUDINARY_UPLOAD_MARKER = "/upload/";

export interface CloudinaryTransformOptions {
  width: number;
  height?: number;
  crop?: "fill" | "limit";
}

export function cloudinaryTransform(url: string, options: CloudinaryTransformOptions): string {
  const markerIndex = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  if (markerIndex === -1) return url;

  const insertAt = markerIndex + CLOUDINARY_UPLOAD_MARKER.length;
  const crop = options.crop ?? "limit";
  const segments = [
    `w_${Math.round(options.width)}`,
    options.height ? `h_${Math.round(options.height)}` : null,
    `c_${crop}`,
    // Same quality/format auto-negotiation already used at upload time --
    // lets Cloudinary pick the best compressed encoding (WebP/AVIF where
    // the requesting browser supports it) per delivery, not just per upload.
    "q_auto",
    "f_auto",
  ].filter((segment): segment is string => Boolean(segment));

  return `${url.slice(0, insertAt)}${segments.join(",")}/${url.slice(insertAt)}`;
}

/** Builds a `srcset` string requesting the same crop at multiple widths,
 * for pairing with a `sizes` attribute on high-DPR displays. Returns
 * `undefined` for non-Cloudinary URLs so callers can omit the attribute
 * entirely rather than render a srcset of unchanged duplicate URLs. */
export function cloudinarySrcSet(
  url: string,
  widths: number[],
  options: Omit<CloudinaryTransformOptions, "width"> = {},
): string | undefined {
  if (url.indexOf(CLOUDINARY_UPLOAD_MARKER) === -1) return undefined;
  return widths.map((w) => `${cloudinaryTransform(url, { ...options, width: w })} ${w}w`).join(", ");
}
