import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StoragePort } from '../application/interfaces';

const ROOT = process.env.ATTACHMENT_LOCAL_ROOT ?? path.resolve(process.cwd(), 'uploads', 'attachments');

@Injectable()
export class LocalDiskStorage implements StoragePort {
  private readonly log = new Logger(LocalDiskStorage.name);

  async save(input: { buffer: Buffer; filename: string; mimeType: string }): Promise<{
    storageKey: string;
  }> {
    await fs.mkdir(ROOT, { recursive: true });
    const ext = path.extname(input.filename) || '';
    const key = `${randomUUID()}${ext}`;
    const fullPath = path.join(ROOT, key);
    await fs.writeFile(fullPath, input.buffer);
    return { storageKey: key };
  }

  async read(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const fullPath = this.resolveSafe(storageKey);
    const buffer = await fs.readFile(fullPath);
    return { buffer, mimeType: 'application/octet-stream' };
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolveSafe(storageKey));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'ENOENT') {
        this.log.warn(`unlink failed key=${storageKey} code=${code}`);
        throw err;
      }
    }
  }

  /** path traversal 차단 — storageKey 가 ROOT 하위에 들어가는지 검증. */
  private resolveSafe(key: string): string {
    const resolved = path.resolve(ROOT, key);
    if (!resolved.startsWith(path.resolve(ROOT) + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }
}
