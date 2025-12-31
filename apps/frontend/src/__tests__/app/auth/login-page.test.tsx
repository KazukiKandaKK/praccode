import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

const mockLoginWithCredentials = vi.fn();

vi.mock('@/app/actions/auth', () => ({
  loginWithCredentials: (...args: unknown[]) => mockLoginWithCredentials(...args),
}));

const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    useSearchParams: () => mockUseSearchParams(),
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockLoginWithCredentials.mockReset();
  });

  it('shows registered success message when query param exists', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('registered=1'));

    render(<LoginPage />);

    expect(screen.getByText('登録が完了しました。ログインしてください。')).toBeTruthy();
  });

  it('shows error message when login fails', async () => {
    mockLoginWithCredentials.mockResolvedValue({ error: 'メールアドレスが未認証です' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), {
      target: { value: 'wrongpass' },
    });

    const form = screen.getByLabelText('メールアドレス').closest('form') as Element;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText(/メールアドレスが未認証です/)).toBeTruthy()
    );
  });

  it('displays loading text while submitting', async () => {
    let resolveLogin: (value: unknown) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    // @ts-expect-error resolveLogin is assigned synchronously above
    mockLoginWithCredentials.mockReturnValue(loginPromise);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), {
      target: { value: 'password' },
    });

    const form = screen.getByLabelText('メールアドレス').closest('form') as Element;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'ログイン中...' })).toBeTruthy()
    );

    // complete promise to avoid unhandled rejection
    resolveLogin({});
    await waitFor(() => expect(mockLoginWithCredentials).toHaveBeenCalled());
  });
});
