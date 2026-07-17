import { NextFunction, Request, Response } from "express";
import { brotliCompressSync, gzipSync, constants as zlibConstants } from "node:zlib";

const MIN_COMPRESSIBLE_BYTES = 1024; // below this, compression overhead isn't worth it

/**
 * Hand-rolled response compression using Node's built-in `zlib`, in the
 * same spirit as this codebase's other hand-rolled infrastructure
 * (WebSocket framing, JWT, SMTP client) -- avoids adding the `compression`
 * npm package as a new dependency (Phase 6 Part 3: performance).
 *
 * Wraps res.send (which res.json() calls internally in Express, so this
 * covers every JSON response the API returns) rather than res.write/end,
 * because every response in this app is built as a single buffered
 * string/object via res.json() -- there's no chunked/streaming response
 * body to handle here, which is what makes hand-rolling this safe to do
 * correctly in a small amount of code. Brotli is preferred over gzip when
 * the client advertises support (smaller output for the same content);
 * gzip is the fallback for older clients.
 */
export function compression() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const acceptEncoding = req.header("accept-encoding") ?? "";
    const supportsBrotli = acceptEncoding.includes("br");
    const supportsGzip = acceptEncoding.includes("gzip");

    if (!supportsBrotli && !supportsGzip) {
      next();
      return;
    }

    const originalSend = res.send.bind(res);

    res.send = ((body?: unknown): Response => {
      if (body === undefined || body === null) {
        return originalSend(body as never);
      }

      // Already-compressed or already-committed responses (e.g. a
      // different middleware set Content-Encoding, or headers are already
      // flushed) are passed through untouched.
      if (res.getHeader("Content-Encoding") || res.headersSent) {
        return originalSend(body as never);
      }

      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));

      if (buffer.length < MIN_COMPRESSIBLE_BYTES) {
        return originalSend(body as never);
      }

      const compressed = supportsBrotli
        ? brotliCompressSync(buffer, {
            params: {
              [zlibConstants.BROTLI_PARAM_QUALITY]: 4, // favor speed over max ratio for request-time compression
            },
          })
        : gzipSync(buffer, { level: 6 });

      res.setHeader("Content-Encoding", supportsBrotli ? "br" : "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      res.removeHeader("Content-Length");

      return originalSend(compressed as never);
    }) as typeof res.send;

    next();
  };
}
