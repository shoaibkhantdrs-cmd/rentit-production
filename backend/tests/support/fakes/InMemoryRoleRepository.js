"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryRoleRepository = void 0;
const Role_1 = require("@/domain/entities/Role");
const ids_1 = require("./ids");
class InMemoryRoleRepository {
    roles = new Map();
    constructor(seed = true) {
        if (seed) {
            const now = new Date();
            for (const name of Role_1.ROLE_NAMES) {
                const role = {
                    id: (0, ids_1.newId)(),
                    name,
                    description: null,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null,
                };
                this.roles.set(role.id, role);
            }
        }
    }
    async findByName(name) {
        for (const role of this.roles.values()) {
            if (role.name === name && !role.deletedAt)
                return role;
        }
        return null;
    }
    async findAll() {
        return [...this.roles.values()].filter((r) => !r.deletedAt);
    }
}
exports.InMemoryRoleRepository = InMemoryRoleRepository;
