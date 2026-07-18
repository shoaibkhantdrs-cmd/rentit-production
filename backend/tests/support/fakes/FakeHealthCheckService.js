"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeHealthCheckService = void 0;
class FakeHealthCheckService {
    healthy = true;
    async isDatabaseHealthy() {
        return this.healthy;
    }
}
exports.FakeHealthCheckService = FakeHealthCheckService;
