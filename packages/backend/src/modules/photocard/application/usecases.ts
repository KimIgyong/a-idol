import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { PhotocardRarity } from '@a-idol/shared';
import type {
  PhotocardRepository,
  PhotocardSetRecord,
  PhotocardTemplateRecord,
  UserPhotocardRecord,
} from './interfaces';
import { PHOTOCARD_REPOSITORY } from './interfaces';

@Injectable()
export class ListPhotocardSetsUseCase {
  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly repo: PhotocardRepository,
  ) {}
  execute(opts: { activeOnly: boolean }): Promise<PhotocardSetRecord[]> {
    return this.repo.listSets(opts);
  }
}

@Injectable()
export class GetPhotocardSetUseCase {
  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly repo: PhotocardRepository,
  ) {}
  async execute(id: string): Promise<PhotocardSetRecord> {
    const row = await this.repo.findSetById(id);
    if (!row) throw new DomainError(ErrorCodes.PHOTOCARD_SET_NOT_FOUND, 'Set not found');
    return row;
  }
}

@Injectable()
export class ListMyPhotocardsUseCase {
  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly repo: PhotocardRepository,
  ) {}
  execute(userId: string, take = 100): Promise<UserPhotocardRecord[]> {
    return this.repo.listUserInventory(userId, take);
  }
}

@Injectable()
export class CreatePhotocardSetUseCase {
  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly repo: PhotocardRepository,
  ) {}
  execute(input: {
    name: string;
    description?: string | null;
    idolId?: string | null;
  }): Promise<PhotocardSetRecord> {
    return this.repo.createSet({
      name: input.name,
      description: input.description ?? null,
      idolId: input.idolId ?? null,
    });
  }
}

@Injectable()
export class UpdatePhotocardSetUseCase {
  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly repo: PhotocardRepository,
  ) {}
  execute(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      idolId?: string | null;
      isActive?: boolean;
    },
  ): Promise<PhotocardSetRecord> {
    return this.repo.updateSet(id, patch);
  }
}

@Injectable()
export class AddPhotocardTemplateUseCase {
  constructor(
    @Inject(PHOTOCARD_REPOSITORY) private readonly repo: PhotocardRepository,
  ) {}
  execute(
    setId: string,
    input: {
      name: string;
      imageUrl?: string | null;
      rarity?: PhotocardRarity;
      dropWeight?: number;
    },
  ): Promise<PhotocardTemplateRecord> {
    return this.repo.addTemplate(setId, {
      name: input.name,
      imageUrl: input.imageUrl ?? null,
      rarity: input.rarity ?? 'COMMON',
      dropWeight: input.dropWeight ?? 10,
    });
  }
}
