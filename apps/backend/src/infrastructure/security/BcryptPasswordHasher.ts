import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, 10);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
