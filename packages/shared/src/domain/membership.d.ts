export interface MembershipProps {
    readonly id: string;
    readonly userId: string;
    readonly fanClubId: string;
    readonly joinedAt: Date;
    readonly leftAt: Date | null;
}
export declare class Membership {
    private readonly props;
    constructor(props: MembershipProps);
    get id(): string;
    get userId(): string;
    get fanClubId(): string;
    get isActive(): boolean;
    canChat(): boolean;
    toJSON(): {
        id: string;
        userId: string;
        fanClubId: string;
        joinedAt: Date;
        leftAt: Date | null;
    };
}
//# sourceMappingURL=membership.d.ts.map