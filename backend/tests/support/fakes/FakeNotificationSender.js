"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeNotificationSender = void 0;
class FakeNotificationSender {
    sent = [];
    async send(input) {
        this.sent.push(input);
    }
}
exports.FakeNotificationSender = FakeNotificationSender;
