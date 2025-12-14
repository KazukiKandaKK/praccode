import { promises as fs } from 'fs';
import { join } from 'path';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const MAIL_DIR = join(process.cwd(), 'tmp', 'mail');

/**
 * メールを送信（開発環境ではファイルに保存）
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    // ディレクトリが存在しない場合は作成
    await fs.mkdir(MAIL_DIR, { recursive: true });

    // タイムスタンプ付きのファイル名を生成（JST）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000; // +9時間
    const jstDate = new Date(now.getTime() + jstOffset);
    const timestamp = jstDate.toISOString().replace(/[:.]/g, '-').replace('Z', 'JST');
    const sanitizedTo = options.to.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${timestamp}_${sanitizedTo}.html`;

    // メール内容をHTMLファイルとして保存
    const emailContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${options.subject}</title>
</head>
<body>
  <h2>To: ${options.to}</h2>
  <h3>Subject: ${options.subject}</h3>
  <hr>
  ${options.html}
  ${options.text ? `<hr><pre>${options.text}</pre>` : ''}
</body>
</html>`;

    const filePath = join(MAIL_DIR, filename);
    await fs.writeFile(filePath, emailContent, 'utf-8');

    console.log(`[Mail] Email saved to: ${filePath}`); // eslint-disable-line no-console
    // eslint-disable-next-line no-console
    console.log(`[Mail] Current working directory: ${process.cwd()}`);
    // eslint-disable-next-line no-console
    console.log(`[Mail] Mail directory: ${MAIL_DIR}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Mail] Failed to save email:', error);
    throw error;
  }
}

/**
 * メール認証確認メールを送信
 */
export async function sendEmailVerification(
  to: string,
  name: string | undefined,
  confirmUrl: string
): Promise<void> {
  const displayName = name || 'ユーザー';
  await sendEmail({
    to,
    subject: 'メールアドレスの確認',
    html: `
      <h1>ようこそ、${displayName}さん！</h1>
      <p>アカウント登録ありがとうございます。</p>
      <p>以下のリンクをクリックして、メールアドレスの確認を完了してください：</p>
      <p><a href="${confirmUrl}" style="display: inline-block; padding: 10px 20px; background-color: #06b6d4; color: white; text-decoration: none; border-radius: 5px;">メールアドレスを確認</a></p>
      <p>または、以下のURLをブラウザにコピー＆ペーストしてください：</p>
      <p><code>${confirmUrl}</code></p>
      <p>このリンクは3日間有効です。</p>
      <p>もしこのリクエストをしていない場合は、このメールを無視してください。</p>
    `,
    text: `ようこそ、${displayName}さん！\n\nアカウント登録ありがとうございます。\n\n以下のリンクをクリックして、メールアドレスの確認を完了してください：\n${confirmUrl}\n\nこのリンクは3日間有効です。`,
  });
}

/**
 * ウェルカムメールを送信（認証完了後）
 */
export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  const displayName = name || 'ユーザー';
  await sendEmail({
    to,
    subject: 'ようこそ！アカウント登録が完了しました',
    html: `
      <h1>ようこそ、${displayName}さん！</h1>
      <p>メールアドレスの確認が完了しました。</p>
      <p>コードリーディング・ライティングの学習を始めましょう！</p>
      <p>ご質問やご不明な点がございましたら、お気軽にお問い合わせください。</p>
    `,
    text: `ようこそ、${displayName}さん！\n\nメールアドレスの確認が完了しました。\nコードリーディング・ライティングの学習を始めましょう！`,
  });
}

/**
 * メール変更確認メールを送信
 */
export async function sendEmailChangeConfirmation(
  to: string,
  newEmail: string,
  confirmUrl: string
): Promise<void> {
  await sendEmail({
    to: newEmail,
    subject: 'メールアドレス変更の確認',
    html: `
      <h1>メールアドレス変更の確認</h1>
      <p>現在のメールアドレス: <strong>${to}</strong></p>
      <p>新しいメールアドレス: <strong>${newEmail}</strong></p>
      <p>以下のリンクをクリックして、メールアドレスの変更を確定してください：</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>このリンクは1時間有効です。</p>
      <p>もしこのリクエストをしていない場合は、このメールを無視してください。</p>
    `,
    text: `メールアドレス変更の確認\n\n現在のメールアドレス: ${to}\n新しいメールアドレス: ${newEmail}\n\n以下のリンクをクリックして、メールアドレスの変更を確定してください：\n${confirmUrl}\n\nこのリンクは1時間有効です。`,
  });
}

/**
 * パスワードリセットメールを送信
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string | undefined,
  resetUrl: string
): Promise<void> {
  const displayName = name || 'ユーザー';
  await sendEmail({
    to,
    subject: 'パスワードリセット',
    html: `
      <h1>パスワードリセット</h1>
      <p>${displayName}さん、</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #06b6d4; color: white; text-decoration: none; border-radius: 5px;">パスワードをリセット</a></p>
      <p>または、以下のURLをブラウザにコピー＆ペーストしてください：</p>
      <p><code>${resetUrl}</code></p>
      <p>このリンクは1時間有効です。</p>
      <p>もしこのリクエストをしていない場合は、このメールを無視してください。</p>
    `,
    text: `パスワードリセット\n\n${displayName}さん、\n\nパスワードリセットのリクエストを受け付けました。\n以下のリンクをクリックして、新しいパスワードを設定してください：\n${resetUrl}\n\nこのリンクは1時間有効です。`,
  });
}
