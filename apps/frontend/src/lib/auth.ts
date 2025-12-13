import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

// Server-side uses API_URL (container-to-container), client-side uses NEXT_PUBLIC_API_URL
// In Docker, use service name 'api' for container-to-container communication
// This file runs on server-side, so always use API_URL
// Note: NextAuth.js may need explicit env var access
const getApiUrl = () => {
  // Try API_URL first (for Docker container-to-container)
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  // Fallback to api service name (Docker Compose)
  return 'http://api:3001';
};

const API_URL = getApiUrl();

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        try {
          // Call API to authenticate
          const apiUrl = API_URL;
          const loginUrl = `${apiUrl}/auth/login`;

          const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Auth API error: ${response.status} - ${errorText}`);
            return null;
          }

          const user = await response.json();
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error('Auth fetch error:', error);
          console.error('API_URL:', API_URL);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
