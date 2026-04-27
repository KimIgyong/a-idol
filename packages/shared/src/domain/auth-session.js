"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSession = void 0;
class AuthSession {
    props;
    constructor(props) {
        this.props = props;
    }
    get id() { return this.props.id; }
    get userId() { return this.props.userId; }
    get expiresAt() { return this.props.expiresAt; }
    get revokedAt() { return this.props.revokedAt; }
    get refreshTokenHash() { return this.props.refreshTokenHash; }
    isActive(now = new Date()) {
        return this.revokedAt === null && this.expiresAt > now;
    }
    toJSON() { return { ...this.props }; }
}
exports.AuthSession = AuthSession;
//# sourceMappingURL=auth-session.js.map