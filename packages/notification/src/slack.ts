/**
 * Slack Incoming Webhook で通知を送信する。
 *
 * - webhookUrl が未設定（空文字 or undefined）の場合は何もしない
 * - 送信失敗時はログ出力のみ（呼び出し元の処理を止めない）
 */
export async function sendSlackWebhook(
  webhookUrl: string | undefined,
  payload: { text: string; blocks?: unknown[] }
): Promise<void> {
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(
        `[notification] Slack webhook failed: status=${res.status} body=${await res.text()}`
      );
    }
  } catch (err) {
    console.error(
      `[notification] Slack webhook error:`,
      err instanceof Error ? err.message : err
    );
  }
}
