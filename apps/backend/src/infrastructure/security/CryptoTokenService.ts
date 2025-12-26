import crypto from 'node:crypto';
import { ITokenService, TokenPayload } from '../../domain/ports/ITokenService';

export class CryptoTokenService implements ITokenService {
  generate(): TokenPayload {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    return { token, tokenHash };
  }

  hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
