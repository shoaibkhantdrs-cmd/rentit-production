"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeEmailService = void 0;
class FakeEmailService {
    sent = [];
    async send(message) {
        this.sent.push(message);
    }
}
exports.FakeEmailService = FakeEmailService;
