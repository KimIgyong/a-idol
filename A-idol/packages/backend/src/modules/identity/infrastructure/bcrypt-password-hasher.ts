import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../../../config/config.schema';
import type { PasswordHasher } from '../application/interfaces';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cfg: AppConfig) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cfg.bcryptRounds);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
