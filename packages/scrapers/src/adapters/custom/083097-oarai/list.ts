/**
 * 大洗町議会 -- list フェーズ
 *
 * 議事録トップページをスクレイピングし、各会議セッションのPDFリンクを収集する。
 *
 * ページ構造:
 *   - h4 タグ: 会議セッション名 (例: 令和7年第4回議会定例会) ← 令和5年第4回以降の新しいセッション
 *   - p > strong タグ: 会議セッション名 ← 令和5年第3回以前の古いセッション
 *   - a タグ: PDF リンク (uploads/ パスを含む)
 *
 * URL 構造:
 *   - トップ: https://www.town.oarai.lg.jp/oaraigikai/%e8%ad%b0%e4%ba%8b%e9%8c%b2
 *   - PDF: https://www.town.oarai.lg.jp/oaraigikai/wp/wp-content/uploads/{YEAR}/{MONTH}/{FILENAME}.pdf
 */

import { TOP_PAGE_URL, detectMeetingType, parseWarekiYear, fetchPage } from "./shared";

export interface OaraiPdfRecord {
  /** 会議タイトル（例: "令和6年第4回議会定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** ファイル名から抽出した月・日（例: "12月3日"） */
  dayLabel: string;
}

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfRecordList(
  _baseUrl: string,
  year: number
): Promise<OaraiPdfRecord[]> {
  const html = await fetchPage(TOP_PAGE_URL);
  if (!html) return [];

  return parseSessionsFromHtml(html, year);
}

// --- HTML パーサー（テスト用に export） ---

export interface SessionInfo {
  /** 会議タイトル（例: "令和6年第4回議会定例会"） */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF リンクリスト */
  pdfLinks: Array<{ url: string; label: string }>;
}

/**
 * トップページ HTML から会議セッション情報を抽出する。
 *
 * h4 タグの後続する PDF リンクを同じセッションに紐づける。
 * h4 タグが次の h4 タグまでのリンクを管理する。
 */
export function parseSessionsFromHtml(html: string, year: number): OaraiPdfRecord[] {
  const records: OaraiPdfRecord[] = [];

  // ページ構造の注記:
  // 新しいセッション（令和5年第4回以降）は <h4> タグを使用。
  // 古いセッション（令和5年第3回以前）は <p><strong>...</strong></p> タグを使用。
  // 両方のパターンを組み合わせて全セッションを抽出する。
  const headingPattern =
    /(?:<h4[^>]*>([\s\S]*?)<\/h4>|<p[^>]*><strong>([\s\S]*?)<\/strong><\/p>)/gi;

  // まず全ての見出しの位置とテキストを取得
  const sessions: Array<{ title: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = headingPattern.exec(html)) !== null) {
    const rawTitle = (m[1] ?? m[2])!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    // 議会セッション名のみを対象にする（令和・平成を含む見出し）
    if (!parseWarekiYear(rawTitle)) continue;
    sessions.push({
      title: rawTitle,
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  if (sessions.length === 0) return [];

  // 各セッションのHTML範囲を設定（次の h4 の直前まで）
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]!;
    const nextSession = sessions[i + 1];
    const sectionEnd = nextSession ? nextSession.start : html.length;
    const sectionHtml = html.slice(session.end, sectionEnd);

    // セッションのタイトルから年を抽出し、対象年と一致するか確認
    const sessionYear = parseWarekiYear(session.title);
    if (sessionYear !== year) continue;

    // このセクション内の PDF リンクを抽出（目次を除く）
    const localPdfPattern = new RegExp(
      '<a\\s[^>]*href="(https?://[^"]*wp-content/uploads/[^"]+\\.pdf)"[^>]*>([^<]*)</a>',
      "gi"
    );

    let pdfMatch: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((pdfMatch = localPdfPattern.exec(sectionHtml)) !== null) {
      const url = pdfMatch[1]!;
      const rawLabel = pdfMatch[2]!.replace(/\s+/g, " ").trim();

      // 重複 URL はスキップ
      if (seen.has(url)) continue;
      seen.add(url);

      // 目次 PDF はスキップ（発言データなし）
      if (rawLabel.includes("目次") || url.includes("目次")) continue;

      // 日付ラベルを抽出（例: "１日目（12月3日）" → "12月3日"）
      const dayLabel = extractDayLabel(rawLabel);

      records.push({
        title: session.title,
        pdfUrl: url,
        meetingType: detectMeetingType(session.title),
        dayLabel,
      });
    }
  }

  return records;
}

/**
 * リンクテキストから日付ラベルを抽出する。
 * 例: "１日目（12月3日）" → "12月3日"
 * 例: "1日目（12月22日）" → "12月22日"
 */
export function extractDayLabel(label: string): string {
  // 全角数字を半角に変換
  const normalized = label.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  const m = normalized.match(/[（(](\d+月\d+日)[）)]/);
  if (m?.[1]) return m[1]!;

  return label;
}

/**
 * URL からファイル名を取得する（テスト・externalId 用）
 */
export function extractFileName(url: string): string {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/\/([^/]+)\.pdf$/);
  return match?.[1] ?? url;
}
