"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryUserRoleRepository = void 0;
class InMemoryUserRoleRepository {
    roleRepo;
    // Map<userId, Set<roleId>>
    assignments = new Map();
    constructor(roleRepo) {
        this.roleRepo = roleRepo;
    }
    async assign(userId, roleId, _assignedBy = null) {
        const set = this.assignments.get(userId) ?? new Set();
        set.add(roleId);
        this.assignments.set(userId, set);
    }
    async remove(userId, roleId) {
        this.assignments.get(userId)?.delete(roleId);
    }
    async listRoleNamesForUser(userId) {
        const roleIds = this.assignments.get(userId) ?? new Set();
        const names = [];
        for (const roleId of roleIds) {
            const role = this.roleRepo.roles.get(roleId);
            if (role && !role.deletedAt)
                names.push(role.name);
        }
        return names;
    }
}
exports.InMemoryUserRoleRepository = InMemoryUserRoleRepository;
