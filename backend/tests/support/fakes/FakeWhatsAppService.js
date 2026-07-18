"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeWhatsAppService = void 0;
class FakeWhatsAppService {
    sent = [];
    async sendTemplate(message) {
        this.sent.push(message);
    }
}
exports.FakeWhatsAppService = FakeWhatsAppService;
