"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FanClub = void 0;
class FanClub {
    props;
    constructor(props) {
        this.props = props;
    }
    get id() { return this.props.id; }
    get idolId() { return this.props.idolId; }
    get tier() { return this.props.tier; }
    get price() { return this.props.price; }
    toJSON() { return { ...this.props }; }
}
exports.FanClub = FanClub;
//# sourceMappingURL=fan-club.js.map