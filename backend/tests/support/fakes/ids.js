"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newId = void 0;
const node_crypto_1 = require("node:crypto");
const newId = () => (0, node_crypto_1.randomUUID)();
exports.newId = newId;
