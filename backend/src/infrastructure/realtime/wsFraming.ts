import { createHash } from "crypto";

/**
 * The pure, dependency-free half of the RFC 6455 WebSocket implementation
 * (WebSocketGateway.ts) -- handshake accept-key derivation and frame
 * encode/decode, using only Node's built-in `crypto`. Deliberately kept
 * separate from WebSocketGateway.ts itself, which also imports the app's
 * shared logger (and therefore `pino`): this file can be unit-tested in
 * this sandbox (no npm registry access) without pulling in a dependency
 * that isn't installed, the same reasoning that keeps haversine.ts and
 * buildPropertySearchQuery.ts's pure pieces separate from their
 * Postgres-touching callers.
 */
const WEBSOCKET_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
export const MAX_FRAME_BYTES = 64 * 1024;
export const OPCODE = { CONTINUATION: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa } as const;

export function acceptKeyFor(clientKey: string): string {
  return createHash("sha1").update(clientKey + WEBSOCKET_MAGIC).digest("base64");
}

export function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const payloadLength = payload.length;
  let header: Buffer;

  if (payloadLength < 126) {
    header = Buffer.from([0x80 | opcode, payloadLength]);
  } else if (payloadLength < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  return Buffer.concat([header, payload]);
}

/** Tries to decode exactly one frame from the front of `buffer`. Returns
 * null if the buffer doesn't yet hold a complete frame (wait for more
 * data). Never mutates `buffer` -- the caller slices off what was consumed. */
export function tryDecodeFrame(
  buffer: Buffer,
): { opcode: number; payload: Buffer; consumed: number } | null {
  if (buffer.length < 2) return null;

  const fin = (buffer[0] & 0x80) !== 0;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let payloadLength = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    const big = buffer.readBigUInt64BE(offset);
    payloadLength = Number(big);
    offset += 8;
  }

  if (payloadLength > MAX_FRAME_BYTES) {
    throw new Error(`WebSocket frame too large (${payloadLength} bytes)`);
  }
  if (!fin) {
    throw new Error("Fragmented WebSocket frames are not supported");
  }

  let maskKey: Buffer | null = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLength) return null;

  let payload = buffer.subarray(offset, offset + payloadLength);
  if (maskKey) {
    const unmasked = Buffer.alloc(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      unmasked[i] = payload[i] ^ maskKey[i % 4];
    }
    payload = unmasked;
  }

  return { opcode, payload, consumed: offset + payloadLength };
}
