/**
 * kensakusystem.jp 共通ユーティリティ
 */

export const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/** 日本語の全角数字を半角に正規化 */
export function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * テキストから日付を抽出 (YYYY-MM-DD 形式で返す)
 */
export function extractDate(text: string): string | null {
  const normalized = normalizeFullWidth(text);

  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const [era, base] of Object.entries(wareki)) {
    const m = normalized.match(
      new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
    );
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  const m = normalized.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

/** テキストから会議タイプを検出 */
export function detectMeetingType(text: string): string {
  if (text.includes("委員会")) return "committee";
  if (text.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** HTML から script タグや style タグを除去し、プレーンテキストを抽出 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** fetch して Shift-JIS → UTF-8 に変換 */
export async function fetchWithEncoding(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buffer);
  } catch {
    return null;
  }
}

/** POST して Shift-JIS → UTF-8 に変換 */
export async function fetchWithEncodingPost(
  url: string,
  body: string
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buffer);
  } catch {
    return null;
  }
}

/** Raw bytes として GET 取得 */
export async function fetchRawBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Raw bytes として POST 取得 */
export async function fetchRawBytesPost(
  url: string,
  body: string
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Shift-JIS バイト列を UTF-8 文字列にデコード */
export function decodeShiftJis(bytes: Uint8Array): string {
  return new TextDecoder("shift_jis").decode(bytes);
}

/** Uint8Array をパーセントエンコード (POST body 用) */
export function percentEncodeBytes(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
  }
  return result;
}

/**
 * Shift-JIS raw bytes から `document.viewtree.treedepth.value='...'` の
 * 値部分の raw バイト列を全て抽出する。
 *
 * Shift-JIS 2バイト文字を正しくスキップすることで、
 * 日本語文字の第2バイトが `'` (0x27) に誤マッチするのを防ぐ。
 */
export function extractTreedepthRawBytes(rawBytes: Uint8Array): Uint8Array[] {
  const results: Uint8Array[] = [];
  const markerStr = "document.viewtree.treedepth.value='";
  const markerBytes = Array.from(markerStr, (c) => c.charCodeAt(0));

  let i = 0;
  outer: while (i <= rawBytes.length - markerBytes.length) {
    for (let j = 0; j < markerBytes.length; j++) {
      if (rawBytes[i + j] !== markerBytes[j]) {
        i++;
        continue outer;
      }
    }

    // マーカーを見つけた。Shift-JIS を正しく解析しながら closing ' を探す
    let pos = i + markerBytes.length;
    const start = pos;
    while (pos < rawBytes.length) {
      const b = rawBytes[pos]!;
      if (b === 0x27) {
        // closing '
        if (pos > start) {
          results.push(rawBytes.slice(start, pos));
        }
        i = pos + 1;
        continue outer;
      }
      // Shift-JIS 2バイト文字の先行バイト
      if ((b >= 0x81 && b <= 0x9f) || (b >= 0xe0 && b <= 0xfc)) {
        pos += 2;
      } else {
        pos++;
      }
    }
    i++;
  }

  return results;
}
