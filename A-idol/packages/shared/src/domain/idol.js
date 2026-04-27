"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Idol = void 0;
class Idol {
    props;
    constructor(props) {
        this.props = props;
    }
    get id() { return this.props.id; }
    get name() { return this.props.name; }
    get agencyId() { return this.props.agencyId; }
    get isPublished() { return this.props.publishedAt !== null && this.props.publishedAt <= new Date(); }
    toJSON() { return { ...this.props }; }
}
exports.Idol = Idol;
//# sourceMappingURL=idol.js.map