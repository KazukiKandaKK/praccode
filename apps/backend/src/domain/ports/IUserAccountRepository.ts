export interface UserProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: 'ADMIN' | 'LEARNER';
  hasPassword: boolean;
  oauthProviders: string[];
}

export interface IUserAccountRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  updateName(userId: string, name: string): Promise<{ id: string; email: string; name: string; image: string | null }>;
  findByEmail(email: string): Promise<{ id: string } | null>;
  findByIdWithPassword(userId: string): Promise<{ id: string; password: string | null } | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateEmail(userId: string, email: string): Promise<{ id: string; email: string; name: string }>;
}
