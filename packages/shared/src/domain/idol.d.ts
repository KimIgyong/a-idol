export interface IdolProps {
    readonly id: string;
    readonly agencyId: string;
    readonly name: string;
    readonly stageName: string | null;
    readonly mbti: string | null;
    readonly bio: string | null;
    readonly heroImageUrl: string | null;
    readonly heartCount: number;
    readonly followCount: number;
    readonly publishedAt: Date | null;
}
export declare class Idol {
    private readonly props;
    constructor(props: IdolProps);
    get id(): string;
    get name(): string;
    get agencyId(): string;
    get isPublished(): boolean;
    toJSON(): {
        id: string;
        agencyId: string;
        name: string;
        stageName: string | null;
        mbti: string | null;
        bio: string | null;
        heroImageUrl: string | null;
        heartCount: number;
        followCount: number;
        publishedAt: Date | null;
    };
}
//# sourceMappingURL=idol.d.ts.map