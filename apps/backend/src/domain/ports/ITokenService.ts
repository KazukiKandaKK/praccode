export interface TokenPayload {
  token: string;
  tokenHash: string;
}

export interface ITokenService {
  generate(): TokenPayload;
  hash(raw: string): string;
}
