/**
 * 手続き系発言の除外とスピーカーグループのチャンキングユーティリティ。
 *
 * statement_chunks テーブルに格納するデータを構築するための純粋関数群。
 * DB アクセスは含まない。
 */

export interface StatementRecord {
  id: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
}

export interface ChunkInput {
  speakerName: string | null;
  speakerRole: string | null;
  statementIds: string[];
  /** 結合した発言テキスト */
  content: string;
  /** スピーカーグループ内での分割順序（1 チャンク = 0） */
  chunkIndex: number;
}

/** 1 チャンクの最大文字数（≒ 2,550 tokens、8,191 token 上限に対して余裕を持たせる） */
const MAX_CHUNK_CHARS = 1500;

/** チャンク生成対象とする最小文字数（トリム後）。これ未満の発言はノイズとしてスキップ */
const MIN_CONTENT_CHARS = 5;

/**
 * 手続き系発言（議長・委員長の議事進行）かどうかを判定する。
 *
 * 除外ルール（DB 分析 20,537 件から導出）:
 * ① ○ 記号 (議長・委員長)     → すべて除外（3,407 件, 100% 手続き）
 * ② △ 記号 (議事進行記号)     → すべて除外（228 件, 平均 15 文字）
 * ③ ◆/◎ + ～xxx～ 50文字未満 → アクション記録を除外（例: ～説明員紹介～）
 * ④ ◆/◎ + 20文字未満         → 極短応答を除外（例: 「理解しました。」）
 */
export function isProcedural(content: string): boolean {
  if (content.startsWith("○")) return true;
  if (content.startsWith("△")) return true;
  if (content.startsWith("◆") || content.startsWith("◎")) {
    if (content.length < 20) return true;
    if (content.length < 50 && /～[^～]{1,30}～/.test(content)) return true;
  }
  return false;
}

/**
 * 内容が短すぎる発言かどうかを判定する。
 *
 * トリム後の文字数が MIN_CONTENT_CHARS 未満の発言は検索ノイズになるため
 * チャンク生成から除外する（例: "異議なし", "はい" など）。
 * ステートメント自体は NDJSON に残る。
 */
export function isTooShort(content: string): boolean {
  return content.trim().length < MIN_CONTENT_CHARS;
}

/**
 * ステートメント列からスピーカーグループのチャンクを構築する。
 *
 * 処理手順:
 * 1. 手続き系発言および短すぎる発言（5文字未満）を除外
 * 2. 連続する同一スピーカーの発言をグループ化
 * 3. 各グループを MAX_CHUNK_CHARS 単位でチャンク分割
 */
export function buildChunksFromStatements(
  statements: StatementRecord[]
): ChunkInput[] {
  const substantive = statements.filter(
    (s) => !isProcedural(s.content) && !isTooShort(s.content),
  );
  const groups = groupBySpeaker(substantive);
  const chunks: ChunkInput[] = [];

  for (const group of groups) {
    const splits = splitGroupIntoChunks(group);
    for (let i = 0; i < splits.length; i++) {
      const batch = splits[i]!;
      chunks.push({
        speakerName: batch[0]!.speakerName,
        speakerRole: batch[0]!.speakerRole,
        statementIds: batch.map((s) => s.id),
        content: batch.map((s) => s.content).join("\n"),
        chunkIndex: i,
      });
    }
  }

  return chunks;
}

function groupBySpeaker(statements: StatementRecord[]): StatementRecord[][] {
  const groups: StatementRecord[][] = [];
  let current: StatementRecord[] = [];

  for (const stmt of statements) {
    if (current.length === 0 || current[0]!.speakerName === stmt.speakerName) {
      current.push(stmt);
    } else {
      groups.push(current);
      current = [stmt];
    }
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

function splitGroupIntoChunks(
  group: StatementRecord[]
): StatementRecord[][] {
  const chunks: StatementRecord[][] = [];
  let current: StatementRecord[] = [];
  let currentChars = 0;

  for (const stmt of group) {
    if (
      current.length > 0 &&
      currentChars + stmt.content.length > MAX_CHUNK_CHARS
    ) {
      chunks.push(current);
      current = [stmt];
      currentChars = stmt.content.length;
    } else {
      current.push(stmt);
      currentChars += stmt.content.length;
    }
  }
  if (current.length > 0) chunks.push(current);

  return chunks;
}
