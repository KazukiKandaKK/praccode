import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '@/app/(auth)/register/page';

const mockRegisterUser = vi.fn();
const mockLoginWithGitHub = vi.fn();

vi.mock('@/app/actions/auth', () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
  loginWithGitHub: (...args: unknown[]) => mockLoginWithGitHub(...args),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    mockRegisterUser.mockReset();
    mockLoginWithGitHub.mockReset();
  });

  it('renders registration form fields', () => {
    render(<RegisterPage />);

    expect(screen.getByText('アカウント作成')).toBeTruthy();
    expect(screen.getByLabelText('ユーザー名')).toBeTruthy();
    expect(screen.getByLabelText('メールアドレス')).toBeTruthy();
    expect(screen.getByLabelText('パスワード')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'アカウントを作成' })).toBeTruthy();
  });

  it('shows error message when registration fails', async () => {
    mockRegisterUser.mockResolvedValue({ error: '登録に失敗しました' });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), {
      target: { value: 'password123' },
    });

    const form = screen.getByLabelText('ユーザー名').closest('form') as Element;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText(/登録に失敗しました/)).toBeTruthy()
    );
  });

  it('shows success state when registration succeeds', async () => {
    mockRegisterUser.mockResolvedValue({
      success: '登録が完了しました。メールアドレスの確認リンクを送信しました。',
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), {
      target: { value: 'password123' },
    });

    const form = screen.getByLabelText('ユーザー名').closest('form') as Element;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText('登録完了')).toBeTruthy()
    );
    expect(
      screen.getByText(/メールアドレスの確認リンクを送信しました/)
    ).toBeTruthy();
  });

  it('displays loading state while submitting', async () => {
    let resolveRegister: (value: unknown) => void;
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    // @ts-expect-error resolveRegister is assigned synchronously above
    mockRegisterUser.mockReturnValue(registerPromise);

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), {
      target: { value: 'password123' },
    });

    const form = screen.getByLabelText('ユーザー名').closest('form') as Element;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '登録中...' })).toBeTruthy()
    );

    resolveRegister({});
    await waitFor(() => expect(mockRegisterUser).toHaveBeenCalled());
  });
});
