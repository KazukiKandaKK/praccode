import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { ApplicationError } from '../errors/ApplicationError';
import { User } from '../../domain/entities/User';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: Pick<User, 'id' | 'email' | 'name' | 'image' | 'role'>;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user || !user.passwordHash) {
      throw new ApplicationError('Invalid credentials', 401);
    }

    if (!user.emailVerified) {
      throw new ApplicationError('Email not verified', 403);
    }

    const match = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!match) {
      throw new ApplicationError('Invalid credentials', 401);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image ?? null,
        role: user.role,
      },
    };
  }
}
