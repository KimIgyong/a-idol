import type {
  AdminAnalyticsOverviewDto,
  AdminIdolDto,
  AdminUserDto,
  AgencyDto,
  AuditionDto,
  AuditionEntryDto,
  AuditionListItemDto,
  AutoMessageStatus,
  AutoMessageTemplateDto,
  CreateDesignAssetDto,
  CreateProjectDocDto,
  DesignAssetDto,
  IdolScheduleDto,
  IdolScheduleType,
  PaginatedResponseDto,
  PhotocardRarity,
  PhotocardSetDto,
  PhotocardSetListItemDto,
  ProductKind,
  ProjectDocCategory,
  ProjectDocDto,
  ProjectDocStatus,
  ProjectDocSummaryDto,
  PurchaseProductDto,
  RoundDto,
  UpdateDesignAssetDto,
  UpdateProjectDocDto,
  VoteRuleDto,
} from '@a-idol/shared';
import { apiFetch } from './api';
import { useAuthStore } from '@/features/auth/auth-store';

function token(): string {
  const session = useAuthStore.getState().session;
  if (!session) throw new Error('Not authenticated');
  return session.accessToken;
}

export const adminApi = {
  // -- agencies --------------------------------------------------------
  listAgencies: () =>
    apiFetch<AgencyDto[]>('/api/v1/admin/catalog/agencies', { token: token() }),
  createAgency: (body: { name: string; description?: string | null }) =>
    apiFetch<AgencyDto>('/api/v1/admin/catalog/agencies', {
      method: 'POST',
      body,
      token: token(),
    }),
  updateAgency: (id: string, body: { name?: string; description?: string | null }) =>
    apiFetch<AgencyDto>(`/api/v1/admin/catalog/agencies/${id}`, {
      method: 'PATCH',
      body,
      token: token(),
    }),
  deleteAgency: (id: string) =>
    apiFetch<void>(`/api/v1/admin/catalog/agencies/${id}`, {
      method: 'DELETE',
      token: token(),
    }),

  // -- idols -----------------------------------------------------------
  // ADR-023 — wire shape 은 snake_case. UI 는 camelCase 유지하고 본 메서드가
  // boundary 에서 snake_case 로 transform.
  listIdols: (opts: { page?: number; size?: number; includeDeleted?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.page) q.set('page', String(opts.page));
    if (opts.size) q.set('size', String(opts.size));
    if (opts.includeDeleted) q.set('include_deleted', 'true');
    const qs = q.toString();
    return apiFetch<PaginatedResponseDto<AdminIdolDto>>(
      `/api/v1/admin/catalog/idols${qs ? '?' + qs : ''}`,
      { token: token() },
    );
  },
  getIdol: (id: string) =>
    apiFetch<AdminIdolDto>(`/api/v1/admin/catalog/idols/${id}`, { token: token() }),
  updateIdol: (
    id: string,
    body: {
      name?: string;
      stageName?: string | null;
      mbti?: string | null;
      bio?: string | null;
      heroImageUrl?: string | null;
      birthdate?: string | null;
      agencyId?: string;
    },
  ) =>
    apiFetch<AdminIdolDto>(`/api/v1/admin/catalog/idols/${id}`, {
      method: 'PATCH',
      body: {
        name: body.name,
        stage_name: body.stageName,
        mbti: body.mbti,
        bio: body.bio,
        hero_image_url: body.heroImageUrl,
        birthdate: body.birthdate,
        agency_id: body.agencyId,
      },
      token: token(),
    }),
  publishIdol: (id: string) =>
    apiFetch<AdminIdolDto>(`/api/v1/admin/catalog/idols/${id}/publish`, {
      method: 'POST',
      token: token(),
    }),
  unpublishIdol: (id: string) =>
    apiFetch<AdminIdolDto>(`/api/v1/admin/catalog/idols/${id}/unpublish`, {
      method: 'POST',
      token: token(),
    }),
  createIdol: (body: {
    agencyId: string;
    name: string;
    stageName?: string | null;
    mbti?: string | null;
    bio?: string | null;
    heroImageUrl?: string | null;
    birthdate?: string | null;
    publishImmediately?: boolean;
  }) =>
    apiFetch<AdminIdolDto>('/api/v1/admin/catalog/idols', {
      method: 'POST',
      body: {
        agency_id: body.agencyId,
        name: body.name,
        stage_name: body.stageName,
        mbti: body.mbti,
        bio: body.bio,
        hero_image_url: body.heroImageUrl,
        birthdate: body.birthdate,
        publish_immediately: body.publishImmediately,
      },
      token: token(),
    }),
  deleteIdol: (id: string) =>
    apiFetch<void>(`/api/v1/admin/catalog/idols/${id}`, {
      method: 'DELETE',
      token: token(),
    }),

  // -- schedules -------------------------------------------------------
  listSchedules: (idolId: string) =>
    apiFetch<IdolScheduleDto[]>(`/api/v1/admin/catalog/idols/${idolId}/schedules`, {
      token: token(),
    }),
  createSchedule: (
    idolId: string,
    body: {
      type?: IdolScheduleType;
      title: string;
      location?: string | null;
      startAt: string;
      endAt?: string | null;
      notes?: string | null;
    },
  ) =>
    apiFetch<IdolScheduleDto>(`/api/v1/admin/catalog/idols/${idolId}/schedules`, {
      method: 'POST',
      body: {
        type: body.type,
        title: body.title,
        location: body.location,
        start_at: body.startAt,
        end_at: body.endAt,
        notes: body.notes,
      },
      token: token(),
    }),
  deleteSchedule: (id: string) =>
    apiFetch<void>(`/api/v1/admin/catalog/schedules/${id}`, {
      method: 'DELETE',
      token: token(),
    }),

  // -- auto-message templates -----------------------------------------
  listAutoMessages: (opts: {
    idolId?: string;
    status?: AutoMessageStatus;
    page?: number;
    size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (opts.idolId) q.set('idolId', opts.idolId);
    if (opts.status) q.set('status', opts.status);
    if (opts.page) q.set('page', String(opts.page));
    if (opts.size) q.set('size', String(opts.size));
    const qs = q.toString();
    return apiFetch<PaginatedResponseDto<AutoMessageTemplateDto>>(
      `/api/v1/admin/chat/auto-messages${qs ? '?' + qs : ''}`,
      { token: token() },
    );
  },
  createAutoMessage: (body: {
    idolId: string;
    title: string;
    content: string;
    scheduledAt: string;
  }) =>
    apiFetch<AutoMessageTemplateDto>('/api/v1/admin/chat/auto-messages', {
      method: 'POST',
      body,
      token: token(),
    }),
  cancelAutoMessage: (id: string) =>
    apiFetch<AutoMessageTemplateDto>(`/api/v1/admin/chat/auto-messages/${id}`, {
      method: 'DELETE',
      token: token(),
    }),
  dispatchAutoMessageNow: (id: string) =>
    apiFetch<AutoMessageTemplateDto>(`/api/v1/admin/chat/auto-messages/${id}/dispatch`, {
      method: 'POST',
      token: token(),
    }),

  // -- auditions --------------------------------------------------------
  listAuditions: () =>
    apiFetch<AuditionListItemDto[]>('/api/v1/admin/auditions', { token: token() }),
  getAudition: (id: string) =>
    apiFetch<AuditionDto>(`/api/v1/admin/auditions/${id}`, { token: token() }),
  createAudition: (body: {
    name: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    idolIds?: string[];
  }) =>
    apiFetch<AuditionDto>('/api/v1/admin/auditions', {
      method: 'POST',
      body: {
        name: body.name,
        description: body.description,
        start_at: body.startAt,
        end_at: body.endAt,
        idol_ids: body.idolIds,
      },
      token: token(),
    }),
  updateAudition: (
    id: string,
    body: {
      name?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
    },
  ) =>
    apiFetch<AuditionDto>(`/api/v1/admin/auditions/${id}`, {
      method: 'PATCH',
      body: {
        name: body.name,
        description: body.description,
        start_at: body.startAt,
        end_at: body.endAt,
      },
      token: token(),
    }),
  transitionAudition: (id: string, action: 'activate' | 'finish' | 'cancel') =>
    apiFetch<AuditionDto>(`/api/v1/admin/auditions/${id}/${action}`, {
      method: 'POST',
      token: token(),
    }),
  deleteAudition: (id: string) =>
    apiFetch<void>(`/api/v1/admin/auditions/${id}`, {
      method: 'DELETE',
      token: token(),
    }),

  addEntries: (auditionId: string, idolIds: string[]) =>
    apiFetch<AuditionEntryDto[]>(`/api/v1/admin/auditions/${auditionId}/entries`, {
      method: 'POST',
      body: { idol_ids: idolIds },
      token: token(),
    }),
  removeEntry: (auditionId: string, idolId: string) =>
    apiFetch<void>(`/api/v1/admin/auditions/${auditionId}/entries/${idolId}`, {
      method: 'DELETE',
      token: token(),
    }),

  createRound: (
    auditionId: string,
    body: {
      name: string;
      orderIndex: number;
      startAt: string;
      endAt: string;
      maxAdvancers?: number | null;
    },
  ) =>
    apiFetch<RoundDto>(`/api/v1/admin/auditions/${auditionId}/rounds`, {
      method: 'POST',
      body: {
        name: body.name,
        order_index: body.orderIndex,
        start_at: body.startAt,
        end_at: body.endAt,
        max_advancers: body.maxAdvancers,
      },
      token: token(),
    }),
  transitionRound: (roundId: string, action: 'activate' | 'close') =>
    apiFetch<RoundDto>(`/api/v1/admin/auditions/rounds/${roundId}/${action}`, {
      method: 'POST',
      token: token(),
    }),
  deleteRound: (roundId: string) =>
    apiFetch<void>(`/api/v1/admin/auditions/rounds/${roundId}`, {
      method: 'DELETE',
      token: token(),
    }),

  getVoteRule: (roundId: string) =>
    apiFetch<VoteRuleDto>(`/api/v1/admin/auditions/rounds/${roundId}/vote-rule`, {
      token: token(),
    }),
  upsertVoteRule: (
    roundId: string,
    body: {
      heartWeight: number;
      smsWeight: number;
      ticketWeight: number;
      dailyHeartLimit?: number;
    },
  ) =>
    apiFetch<VoteRuleDto>(`/api/v1/admin/auditions/rounds/${roundId}/vote-rule`, {
      method: 'PUT',
      body: {
        heart_weight: body.heartWeight,
        sms_weight: body.smsWeight,
        ticket_weight: body.ticketWeight,
        daily_heart_limit: body.dailyHeartLimit,
      },
      token: token(),
    }),

  // -- commerce products ----------------------------------------------
  listProducts: (opts: { activeOnly?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.activeOnly) q.set('activeOnly', 'true');
    const qs = q.toString();
    return apiFetch<PurchaseProductDto[]>(
      `/api/v1/admin/commerce/products${qs ? '?' + qs : ''}`,
      { token: token() },
    );
  },
  createProduct: (body: {
    sku: string;
    kind: ProductKind;
    title: string;
    description?: string | null;
    priceKrw: number;
    deliveryPayload: Record<string, unknown>;
  }) =>
    apiFetch<PurchaseProductDto>('/api/v1/admin/commerce/products', {
      method: 'POST',
      body: {
        sku: body.sku,
        kind: body.kind,
        title: body.title,
        description: body.description,
        price_krw: body.priceKrw,
        delivery_payload: body.deliveryPayload,
      },
      token: token(),
    }),
  updateProduct: (
    id: string,
    body: {
      title?: string;
      description?: string | null;
      priceKrw?: number;
      deliveryPayload?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) =>
    apiFetch<PurchaseProductDto>(`/api/v1/admin/commerce/products/${id}`, {
      method: 'PATCH',
      body: {
        title: body.title,
        description: body.description,
        price_krw: body.priceKrw,
        delivery_payload: body.deliveryPayload,
        is_active: body.isActive,
      },
      token: token(),
    }),

  // -- photocards ------------------------------------------------------
  listPhotocardSets: () =>
    apiFetch<PhotocardSetListItemDto[]>('/api/v1/admin/photocards/sets', { token: token() }),
  getPhotocardSet: (id: string) =>
    apiFetch<PhotocardSetDto>(`/api/v1/admin/photocards/sets/${id}`, { token: token() }),
  createPhotocardSet: (body: {
    name: string;
    description?: string | null;
    idolId?: string | null;
  }) =>
    apiFetch<PhotocardSetDto>('/api/v1/admin/photocards/sets', {
      method: 'POST',
      body,
      token: token(),
    }),
  updatePhotocardSet: (
    id: string,
    body: {
      name?: string;
      description?: string | null;
      idolId?: string | null;
      isActive?: boolean;
    },
  ) =>
    apiFetch<PhotocardSetDto>(`/api/v1/admin/photocards/sets/${id}`, {
      method: 'PATCH',
      body,
      token: token(),
    }),
  addPhotocardTemplate: (
    setId: string,
    body: {
      name: string;
      imageUrl?: string | null;
      rarity?: PhotocardRarity;
      dropWeight?: number;
    },
  ) =>
    apiFetch<PhotocardSetDto>(`/api/v1/admin/photocards/sets/${setId}/templates`, {
      method: 'POST',
      body,
      token: token(),
    }),

  // -- analytics (dashboard) ------------------------------------------
  getAnalyticsOverview: () =>
    apiFetch<AdminAnalyticsOverviewDto>('/api/v1/admin/analytics/overview', {
      token: token(),
    }),

  // -- operators (admin role only) ------------------------------------
  // Read-only first slice (RPT-260426-B §5). Write actions land in a
  // follow-up — viewer/operator는 backend RolesGuard에서 403, frontend도
  // 메뉴 자체를 admin role에만 노출.
  listOperators: () =>
    apiFetch<AdminUserDto[]>('/api/v1/admin/operators', { token: token() }),
  /** T-082 — 잠긴 사용자/운영자 계정 즉시 해제. admin role 전용. */
  unlockAccount: (email: string) =>
    apiFetch<{ unlocked: true }>('/api/v1/admin/operators/unlock-account', {
      method: 'POST',
      body: { email },
      token: token(),
    }),

  // -- T-085 design assets (admin / operator read; admin write) -----------
  listDesignAssets: () =>
    apiFetch<DesignAssetDto[]>('/api/v1/admin/design-assets', { token: token() }),
  createDesignAsset: (body: CreateDesignAssetDto) =>
    apiFetch<DesignAssetDto>('/api/v1/admin/design-assets', {
      method: 'POST',
      body,
      token: token(),
    }),
  updateDesignAsset: (id: string, body: UpdateDesignAssetDto) =>
    apiFetch<DesignAssetDto>(`/api/v1/admin/design-assets/${id}`, {
      method: 'PATCH',
      body,
      token: token(),
    }),
  deleteDesignAsset: (id: string) =>
    apiFetch<void>(`/api/v1/admin/design-assets/${id}`, {
      method: 'DELETE',
      token: token(),
    }),

  // -- Project Documents (ADR / 설계 / WBS / 산출물) -----------------------
  listProjectDocs: (filter?: { category?: ProjectDocCategory; status?: ProjectDocStatus }) => {
    const qs = new URLSearchParams();
    if (filter?.category) qs.set('category', filter.category);
    if (filter?.status) qs.set('status', filter.status);
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiFetch<ProjectDocSummaryDto[]>(`/api/v1/admin/project-docs${suffix}`, { token: token() });
  },
  getProjectDoc: (slug: string) =>
    apiFetch<ProjectDocDto>(`/api/v1/admin/project-docs/${encodeURIComponent(slug)}`, { token: token() }),
  createProjectDoc: (body: CreateProjectDocDto) =>
    apiFetch<ProjectDocDto>('/api/v1/admin/project-docs', {
      method: 'POST',
      body,
      token: token(),
    }),
  updateProjectDoc: (id: string, body: UpdateProjectDocDto) =>
    apiFetch<ProjectDocDto>(`/api/v1/admin/project-docs/${id}`, {
      method: 'PATCH',
      body,
      token: token(),
    }),
  deleteProjectDoc: (id: string) =>
    apiFetch<void>(`/api/v1/admin/project-docs/${id}`, {
      method: 'DELETE',
      token: token(),
    }),
};
