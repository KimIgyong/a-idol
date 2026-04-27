export interface UserDto {
    id: string;
    email: string | null;
    nickname: string;
    avatarUrl: string | null;
    provider: 'email' | 'apple' | 'google' | 'kakao';
    status: 'active' | 'suspended' | 'withdrawn';
    createdAt: string;
}
export interface AuthTokensDto {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface AuthResponseDto extends AuthTokensDto {
    user: UserDto;
}
export interface IdolCardDto {
    id: string;
    name: string;
    stageName: string | null;
    heroImageUrl: string | null;
    heartCount: number;
    followCount: number;
    publishedAt: string | null;
}
export type IdolImageType = 'hero' | 'portrait' | 'editorial' | 'lifestyle' | 'emotional' | 'concept' | 'headshot' | 'character_sheet' | (string & {});
export interface IdolImageDto {
    id: string;
    imageType: IdolImageType;
    imageUrl: string;
    sortOrder: number;
    isApproved: boolean;
}
/**
 * Full idol detail. `profile` mirrors the seed JSON under
 * packages/backend/prisma/seeds/*-profile.json (conceptSeed, coreIdentity,
 * deepProfile, narrative, faceVector). Its shape is deliberately typed as
 * `unknown` here so clients validate with a schema they own instead of
 * inheriting an unstable contract.
 */
export interface IdolDetailDto {
    id: string;
    agencyId: string;
    name: string;
    stageName: string | null;
    birthdate: string | null;
    mbti: string | null;
    bio: string | null;
    heroImageUrl: string | null;
    heartCount: number;
    followCount: number;
    publishedAt: string | null;
    profile: unknown | null;
    images: IdolImageDto[];
}
export interface PaginatedResponseDto<T> {
    items: T[];
    nextCursor: string | null;
    total?: number;
}
export interface HealthResponseDto {
    status: 'ok';
    version: string;
    uptimeSeconds: number;
    timestamp: string;
}
//# sourceMappingURL=index.d.ts.map