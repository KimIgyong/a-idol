"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const errors_1 = require("./errors");
class User {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new User(props);
    }
    get id() { return this.props.id; }
    get email() { return this.props.email; }
    get nickname() { return this.props.nickname; }
    get avatarUrl() { return this.props.avatarUrl; }
    get birthdate() { return this.props.birthdate; }
    get status() { return this.props.status; }
    get provider() { return this.props.provider; }
    isActive() {
        return this.props.status === 'active';
    }
    /**
     * POL-006 — block users under 14 years old.
     */
    static assertMinimumAge(birthdate, at = new Date()) {
        const minAgeYears = 14;
        const ageMs = at.getTime() - birthdate.getTime();
        const yearsOld = ageMs / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsOld < minAgeYears) {
            throw new errors_1.DomainError(errors_1.ErrorCodes.UNDER_AGE, 'User must be at least 14 years old');
        }
    }
    toJSON() {
        return { ...this.props };
    }
}
exports.User = User;
//# sourceMappingURL=user.js.map