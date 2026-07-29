"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicUser = toPublicUser;
/** Fields a client is ever allowed to see. Never spread a raw User onto a response. */
function toPublicUser(user, roles) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        emailVerified: user.emailVerifiedAt !== null,
        phoneVerified: user.phoneVerifiedAt !== null,
        identityVerified: user.identityVerifiedAt !== null,
        roles,
        createdAt: user.createdAt,
    };
}
