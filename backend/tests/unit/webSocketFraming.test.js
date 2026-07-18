"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const crypto_1 = require("crypto");
const wsFraming_1 = require("@/infrastructure/realtime/wsFraming");
function maskClientFrame(opcode, payload) {
    const maskKey = Buffer.from([0x12, 0x34, 0x56, 0x78]);
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++)
        masked[i] = payload[i] ^ maskKey[i % 4];
    let header;
    if (payload.length < 126) {
        header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
    }
    else if (payload.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payload.length, 2);
    }
    else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    return Buffer.concat([header, maskKey, masked]);
}
(0, node_test_1.test)("acceptKeyFor: matches the canonical RFC 6455 handshake example", () => {
    // The exact key/accept pair from RFC 6455 section 1.3.
    const clientKey = "dGhlIHNhbXBsZSBub25jZQ==";
    const expected = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=";
    strict_1.default.equal((0, wsFraming_1.acceptKeyFor)(clientKey), expected);
});
(0, node_test_1.test)("encodeFrame/tryDecodeFrame: round-trips a masked client text frame", () => {
    const payload = Buffer.from(JSON.stringify({ type: "typing", conversationId: "abc", isTyping: true }));
    const wire = maskClientFrame(wsFraming_1.OPCODE.TEXT, payload);
    const decoded = (0, wsFraming_1.tryDecodeFrame)(wire);
    strict_1.default.ok(decoded);
    strict_1.default.equal(decoded?.opcode, wsFraming_1.OPCODE.TEXT);
    strict_1.default.equal(decoded?.consumed, wire.length);
    strict_1.default.deepEqual(JSON.parse(decoded.payload.toString("utf8")), {
        type: "typing",
        conversationId: "abc",
        isTyping: true,
    });
});
(0, node_test_1.test)("tryDecodeFrame: returns null (wait for more data) on a partial frame", () => {
    const payload = Buffer.from("hello world, this is a longer message body");
    const wire = maskClientFrame(wsFraming_1.OPCODE.TEXT, payload);
    const truncated = wire.subarray(0, wire.length - 5);
    strict_1.default.equal((0, wsFraming_1.tryDecodeFrame)(truncated), null);
});
(0, node_test_1.test)("tryDecodeFrame: rejects fragmented frames (FIN bit unset)", () => {
    const payload = Buffer.from("partial");
    const wire = maskClientFrame(wsFraming_1.OPCODE.TEXT, payload);
    wire[0] = wire[0] & 0x7f; // clear the FIN bit
    strict_1.default.throws(() => (0, wsFraming_1.tryDecodeFrame)(wire), /Fragmented/);
});
(0, node_test_1.test)("tryDecodeFrame: rejects frames over the size cap", () => {
    const huge = Buffer.alloc(70 * 1024, "a");
    const wire = maskClientFrame(wsFraming_1.OPCODE.TEXT, huge);
    strict_1.default.throws(() => (0, wsFraming_1.tryDecodeFrame)(wire), /too large/);
});
(0, node_test_1.test)("encodeFrame: server frames are never masked and carry the correct length prefix", () => {
    const payload = Buffer.from("hello");
    const frame = (0, wsFraming_1.encodeFrame)(wsFraming_1.OPCODE.TEXT, payload);
    strict_1.default.equal(frame[0], 0x80 | wsFraming_1.OPCODE.TEXT);
    strict_1.default.equal(frame[1] & 0x80, 0); // MASK bit must be 0 from the server
    strict_1.default.equal(frame[1] & 0x7f, payload.length);
    strict_1.default.deepEqual(frame.subarray(2), payload);
});
(0, node_test_1.test)("encodeFrame: uses the extended 16-bit length for payloads >= 126 bytes", () => {
    const payload = Buffer.alloc(200, "x");
    const frame = (0, wsFraming_1.encodeFrame)(wsFraming_1.OPCODE.TEXT, payload);
    strict_1.default.equal(frame[1] & 0x7f, 126);
    strict_1.default.equal(frame.readUInt16BE(2), 200);
});
(0, node_test_1.test)("sha1 sanity check backing acceptKeyFor", () => {
    // Not testing crypto itself, just confirming the magic-string concat
    // shape acceptKeyFor relies on hasn't silently changed.
    const key = "x3JJHMbDL1EzLkh9GBhXDw==";
    const expected = (0, crypto_1.createHash)("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");
    strict_1.default.equal((0, wsFraming_1.acceptKeyFor)(key), expected);
});
