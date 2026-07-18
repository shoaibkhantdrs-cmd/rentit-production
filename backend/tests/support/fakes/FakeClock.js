"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeClock = void 0;
/** Deterministic clock for tests -- advance() moves time forward explicitly. */
class FakeClock {
    current;
    constructor(start = new Date("2026-01-01T00:00:00.000Z")) {
        this.current = start;
    }
    now() {
        return this.current;
    }
    advance(ms) {
        this.current = new Date(this.current.getTime() + ms);
    }
    set(date) {
        this.current = date;
    }
}
exports.FakeClock = FakeClock;
