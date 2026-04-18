/**
 * Gemini は高負荷時や quota 上限間際で 429 / 503 を返す。
 * retry-after ヒントがあればそれを優先し、無ければ指数バックオフ。
 */
export async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /\b(429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket hang up)\b/i.test(msg)
        || /timed?\s*out/i.test(msg)
        || /timeout/i.test(msg)
        || /fetch failed/i.test(msg);
      if (!retryable || attempt === maxAttempts) break;

      // API が retryDelay を返していればそれを使う
      const retryMs = parseRetryDelayMs(msg) ?? 1000 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 500);
      const delay = retryMs + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/**
 * Gemini のエラー JSON に含まれる retryDelay (例: "23.634105001s" や "682.756ms") を ms で取り出す。
 */
function parseRetryDelayMs(msg: string): number | null {
  const secMatch = msg.match(/"retryDelay"\s*:\s*"([0-9.]+)s"/);
  if (secMatch?.[1]) return Math.ceil(parseFloat(secMatch[1]) * 1000);
  const msMatch = msg.match(/Please retry in ([0-9.]+)ms/);
  if (msMatch?.[1]) return Math.ceil(parseFloat(msMatch[1]));
  const sec2Match = msg.match(/Please retry in ([0-9.]+)s/);
  if (sec2Match?.[1]) return Math.ceil(parseFloat(sec2Match[1]) * 1000);
  return null;
}
