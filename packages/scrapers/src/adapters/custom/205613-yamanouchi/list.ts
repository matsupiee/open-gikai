/**
 * 山ノ内町議会 -- list フェーズ
 *
 * 議事録一覧ページから全 PDF リンクを収集する。
 *
 * 一覧ページは単一ページ（ページネーションなし）で、
 * 全定例会・臨時会の PDF が 1 ページに掲載されている。
 *
 * 構造:
 *   <div class="free-layout-area">
 *     <h2>議事録</h2>
 *     <h3>令和7年第6回定例会（12月）</h3>
 *     <div class="wysiwyg">
 *       <p><a href="//...pdf">・目 次</a></p>
 *       <p><a href="//...pdf">・11月28日 初日</a></p>
 *       <p><a href="//...pdf">・12月4日 一般質問</a>（...）</p>
 *     </div>
 *     <h3>令和7年第5回定例会（9月）</h3>
 *     ...
 *   </div>
 */

import { detectMeetingType, fetchPage, parseSessionYear, resolveUrl, toHalfWidth } from "./shared";

export interface YamanouchiPdfEntry {
  /** 定例会・臨時会名（例: "令和7年第6回定例会（12月）"） */
  sessionName: string;
  /** PDF リンクテキストから取得した日付文字列（例: "11月28日"） */
  date: string;
  /** 種別（例: "初日", "一般質問", "議案審議", "最終日", "目次"） */
  type: string;
  /** 一般質問の質問者名リスト */
  speakers: string[];
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
}

/**
 * リンクテキストから日付を抽出する。
 * 「・11月28日 初日」→ "11月28日"
 * 全角・半角数字に対応
 */
export function extractDateFromLinkText(text: string): string | null {
  const normalized = toHalfWidth(text.trim());
  const match = normalized.match(/(\d+)月\s*(\d+)日/);
  if (!match) return null;
  return `${match[1]}月${match[2]}日`;
}

/**
 * リンクテキストから種別を抽出する。
 * 「・12月4日 一般質問」→ "一般質問"
 * 「・11月28日 初日」→ "初日"
 * 「・目 次」→ "目次"
 */
export function extractTypeFromLinkText(text: string): string {
  const cleaned = text.replace(/^[・\s]+/, "").trim();

  // 目次パターン（日付なし）
  if (/^目\s*次/.test(cleaned)) return "目次";

  // 日付付きパターン
  const normalized = toHalfWidth(cleaned);
  const typeMatch = normalized.match(
    /\d+月\s*\d+日\s*(初日|最終日|一般質問・議案審議|一般質問|議案審議|臨時会)/,
  );
  if (typeMatch) return typeMatch[1]!;

  // 日付なし、その他
  return cleaned;
}

/**
 * 括弧内の質問者名リストを抽出する。
 * 「（1.髙田佳久　2.湯本晴彦　3.畔上恵子）」→ ["髙田佳久", "湯本晴彦", "畔上恵子"]
 */
export function extractSpeakers(text: string): string[] {
  const match = text.match(/[（(]([\d\.\s\S]+?)[）)]/);
  if (!match) return [];

  const raw = match[1]!;
  const speakers: string[] = [];
  const speakerPattern = /\d+[\.．]\s*([^\d\s（）()、。\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = speakerPattern.exec(raw)) !== null) {
    const name = m[1]!.trim().replace(/[\s\u3000]+$/, "");
    if (name) speakers.push(name);
  }
  return speakers;
}

/**
 * 一覧ページ HTML から PDF エントリをパースする。
 *
 * h3 タグで定例会・臨時会を区切り、
 * 直後の div.wysiwyg 内の a[href] から PDF リンクを収集する。
 */
export function parseListPage(html: string): YamanouchiPdfEntry[] {
  const results: YamanouchiPdfEntry[] = [];

  // h3 タグと wysiwyg div の位置を収集
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const sessions: { name: string; position: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = h3Pattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    // 定例会・臨時会の見出しのみ対象
    if (/(令和|平成)/.test(innerText) && /(定例会|臨時会)/.test(innerText)) {
      sessions.push({ name: innerText, position: hm.index + hm[0].length });
    }
  }

  if (sessions.length === 0) return [];

  // wysiwyg div の収集
  const wysiwygPattern = /<div\s[^>]*class="[^"]*wysiwyg[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const wysiwygBlocks: { content: string; position: number }[] = [];
  let wm: RegExpExecArray | null;
  while ((wm = wysiwygPattern.exec(html)) !== null) {
    wysiwygBlocks.push({ content: wm[1]!, position: wm.index });
  }

  // 各 h3 セッションに対応する wysiwyg ブロックを紐付ける
  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si]!;
    const nextSessionPos =
      si + 1 < sessions.length ? sessions[si + 1]!.position : html.length;

    // この h3 の直後にある wysiwyg ブロックを探す
    const block = wysiwygBlocks.find(
      (b) => b.position > session.position && b.position < nextSessionPos,
    );
    if (!block) continue;

    const sessionName = session.name;
    const year = parseSessionYear(sessionName);
    if (!year) continue;

    const meetingType = detectMeetingType(sessionName);

    // wysiwyg 内の a タグを全て抽出
    const linkPattern = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>([^<]*)/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkPattern.exec(block.content)) !== null) {
      const href = lm[1]!;
      const linkInner = lm[2]!;
      const afterLink = lm[3] ?? "";

      if (!href.toLowerCase().endsWith(".pdf")) continue;

      const pdfUrl = resolveUrl(href);
      const linkText = linkInner.replace(/<[^>]+>/g, "").trim();
      const fullText = linkText + afterLink;

      const date = extractDateFromLinkText(linkText) ?? "";
      const type = extractTypeFromLinkText(linkText);
      const speakers =
        type === "一般質問" || type === "一般質問・議案審議"
          ? extractSpeakers(fullText)
          : [];

      results.push({
        sessionName,
        date,
        type,
        speakers,
        pdfUrl,
        meetingType,
        year,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF エントリを収集する。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<YamanouchiPdfEntry[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allEntries = parseListPage(html);
  return allEntries.filter((entry) => entry.year === year);
}
