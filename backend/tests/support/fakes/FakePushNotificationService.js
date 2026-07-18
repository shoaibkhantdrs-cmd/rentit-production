"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakePushNotificationService = void 0;
class FakePushNotificationService {
    sent = [];
    async send(payload) {
        this.sent.push(payload);
    }
    async sendBulk(payloads) {
        this.sent.push(...payloads);
    }
}
exports.FakePushNotificationService = FakePushNotificationService;
