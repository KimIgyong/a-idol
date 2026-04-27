export interface FanClubProps {
    readonly id: string;
    readonly idolId: string;
    readonly tier: 'official';
    readonly price: number;
}
export declare class FanClub {
    private readonly props;
    constructor(props: FanClubProps);
    get id(): string;
    get idolId(): string;
    get tier(): "official";
    get price(): number;
    toJSON(): {
        id: string;
        idolId: string;
        tier: "official";
        price: number;
    };
}
//# sourceMappingURL=fan-club.d.ts.map