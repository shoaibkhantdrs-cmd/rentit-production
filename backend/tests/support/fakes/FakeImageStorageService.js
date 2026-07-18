"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeImageStorageService = void 0;
/** Stands in for Cloudinary -- "uploads" just record the buffer size and hand back a deterministic fake URL. */
class FakeImageStorageService {
    uploaded = [];
    destroyed = [];
    counter = 0;
    async upload(input) {
        this.uploaded.push(input);
        this.counter += 1;
        const publicId = `${input.folder}/fake-${this.counter}`;
        return {
            publicId,
            url: `https://res.cloudinary.test/${publicId}.jpg`,
            width: 1200,
            height: 800,
            format: "jpg",
            bytes: input.buffer.byteLength,
        };
    }
    async destroy(publicId) {
        this.destroyed.push(publicId);
    }
}
exports.FakeImageStorageService = FakeImageStorageService;
