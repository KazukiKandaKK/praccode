'use server';

import { signIn, signOut } from '@/lib/auth';
import { z } from 'zod';
import { redirect } from 'next/navigation';

// Server Actions run on server-side, use container-to-container communication
const API_URL = process.env.API_URL || 'http://api:3001';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function registerUser(formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { name, email, password } = parsed.data;

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (response.status === 409) {
      return { error: 'このメールアドレスは既に登録されています' };
    }

    if (!response.ok) {
      return { error: '登録に失敗しました' };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { error: '登録に失敗しました' };
  }

  redirect('/login?registered=true');
}

export async function loginWithCredentials(formData: FormData) {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return { error: 'メールアドレスまたはパスワードが正しくありません' };
  }
}

export async function loginWithGitHub() {
  await signIn('github', { redirectTo: '/dashboard' });
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}

