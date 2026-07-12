import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import {
  acceptKeyFor,
  encodeFrame,
  tryDecodeFrame,
  OPCODE,
} from "@/infrastructure/realtime/wsFraming";

function maskClientFrame(opcode: number, payload: Buffer): Buffer {
  const maskKey = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ maskKey[i % 4];

  let header: Buffer;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  return Buffer.concat([header, maskKey, masked]);
}

test("acceptKeyFor: matches the canonical RFC 6455 handshake example", () => {
  // The exact key/accept pair from RFC 6455 section 1.3.
  const clientKey = "dGhlIHNhbXBsZSBub25jZQ==";
  const expected = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=";
  assert.equal(acceptKeyFor(clientKey), expected);
});

test("encodeFrame/tryDecodeFrame: round-trips a masked client text frame", () => {
  const payload = Buffer.from(JSON.stringify({ type: "typing", conversationId: "abc", isTyping: true }));
  const wire = maskClientFrame(OPCODE.TEXT, payload);

  const decoded = tryDecodeFrame(wire);
  assert.ok(decoded);
  assert.equal(decoded?.opcode, OPCODE.TEXT);
  assert.equal(decoded?.consumed, wire.length);
  assert.deepEqual(JSON.parse(decoded!.payload.toString("utf8")), {
    type: "typing",
    conversationId: "abc",
    isTyping: true,
  });
});

test("tryDecodeFrame: returns null (wait for more data) on a partial frame", () => {
  const payload = Buffer.from("hello world, this is a longer message body");
  const wire = maskClientFrame(OPCODE.TEXT, payload);
  const truncated = wire.subarray(0, wire.length - 5);

  assert.equal(tryDecodeFrame(truncated), null);
});

test("tryDecodeFrame: rejects fragmented frames (FIN bit unset)", () => {
  const payload = Buffer.from("partial");
  const wire = maskClientFrame(OPCODE.TEXT, payload);
  wire[0] = wire[0] & 0x7f; // clear the FIN bit
  assert.throws(() => tryDecodeFrame(wire), /Fragmented/);
});

test("tryDecodeFrame: rejects frames over the size cap", () => {
  const huge = Buffer.alloc(70 * 1024, "a");
  const wire = maskClientFrame(OPCODE.TEXT, huge);
  assert.throws(() => tryDecodeFrame(wire), /too large/);
});

test("encodeFrame: server frames are never masked and carry the correct length prefix", () => {
  const payload = Buffer.from("hello");
  const frame = encodeFrame(OPCODE.TEXT, payload);
  assert.equal(frame[0], 0x80 | OPCODE.TEXT);
  assert.equal(frame[1] & 0x80, 0); // MASK bit must be 0 from the server
  assert.equal(frame[1] & 0x7f, payload.length);
  assert.deepEqual(frame.subarray(2), payload);
});

test("encodeFrame: uses the extended 16-bit length for payloads >= 126 bytes", () => {
  const payload = Buffer.alloc(200, "x");
  const frame = encodeFrame(OPCODE.TEXT, payload);
  assert.equal(frame[1] & 0x7f, 126);
  assert.equal(frame.readUInt16BE(2), 200);
});

test("sha1 sanity check backing acceptKeyFor", () => {
  // Not testing crypto itself, just confirming the magic-string concat
  // shape acceptKeyFor relies on hasn't silently changed.
  const key = "x3JJHMbDL1EzLkh9GBhXDw==";
  const expected = createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
  assert.equal(acceptKeyFor(key), expected);
});
