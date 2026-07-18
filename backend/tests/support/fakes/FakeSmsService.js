"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeSmsService = void 0;
class FakeSmsService {
    sent = [];
    async send(to, body) {
        this.sent.push({ to, body });
    }
}
exports.FakeSmsService = FakeSmsService;
