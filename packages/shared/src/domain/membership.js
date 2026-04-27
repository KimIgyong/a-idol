"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Membership = void 0;
class Membership {
    props;
    constructor(props) {
        this.props = props;
    }
    get id() { return this.props.id; }
    get userId() { return this.props.userId; }
    get fanClubId() { return this.props.fanClubId; }
    get isActive() { return this.props.leftAt === null; }
    canChat() { return this.isActive; }
    toJSON() { return { ...this.props }; }
}
exports.Membership = Membership;
//# sourceMappingURL=membership.js.map