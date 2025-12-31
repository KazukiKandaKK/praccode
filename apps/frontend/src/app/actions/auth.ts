'use server';

import { signIn, signOut } from '@/lib/auth';
import { z } from 'zod';

// Server Actions run on server-side, prefer API_URL then NEXT_PUBLIC_API_URL, fallback to localhost
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

    // リダイレクトせず、成功メッセージを返す
    return {
      success:
        '登録が完了しました。メールアドレスの確認リンクを送信しました。メールをご確認の上、認証を完了してください。',
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: '登録に失敗しました' };
  }
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

    // NextAuth.jsのエラーメッセージから具体的なエラーを抽出
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('email not verified')) {
        return {
          error: 'メールアドレスが未認証です。メールをご確認の上、認証を完了してください。',
        };
      }
      if (message.includes('invalid credentials')) {
        return { error: 'メールアドレスまたはパスワードが正しくありません' };
      }
      if (message.includes('fetch')) {
        return { error: 'サーバーに接続できませんでした。しばらくしてからお試しください。' };
      }
    }

    return { error: 'ログインに失敗しました。しばらくしてからお試しください。' };
  }
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}
