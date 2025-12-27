import { User } from '../entities/User';

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role?: 'ADMIN' | 'LEARNER';
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findVerifiedByEmailAndName(email: string, name: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  setEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
