import type { AutoMessageStatus } from '@a-idol/shared';

export interface AutoMessageRecord {
  id: string;
  idolId: string;
  idolName: string;
  title: string;
  content: string;
  scheduledAt: Date;
  dispatchedAt: Date | null;
  status: AutoMessageStatus;
  recipients: number;
  failedReason: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface AutoMessageRepository {
  create(input: {
    idolId: string;
    title: string;
    content: string;
    scheduledAt: Date;
    createdBy: string;
  }): Promise<AutoMessageRecord>;
  findById(id: string): Promise<AutoMessageRecord | null>;
  list(opts: {
    idolId?: string;
    status?: AutoMessageStatus;
    take: number;
    skip: number;
  }): Promise<{ items: AutoMessageRecord[]; total: number }>;
  updateStatus(
    id: string,
    patch: {
      status: AutoMessageStatus;
      dispatchedAt?: Date | null;
      recipients?: number;
      failedReason?: string | null;
    },
  ): Promise<AutoMessageRecord>;
}

/**
 * Port for enqueueing auto-message dispatch jobs into BullMQ. Keeping this
 * abstract lets tests assert "a job was enqueued with delay X" without
 * spinning up Redis.
 */
export interface AutoMessageScheduler {
  schedule(input: { templateId: string; scheduledAt: Date }): Promise<void>;
  cancel(templateId: string): Promise<void>;
}

export const AUTO_MESSAGE_REPOSITORY = 'AutoMessageRepository';
export const AUTO_MESSAGE_SCHEDULER = 'AutoMessageScheduler';
