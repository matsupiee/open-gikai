import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

export type NdjsonStatement = {
  id: string;
  meetingId: string;
  kind: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
  contentHash: string;
  startOffset: number | null;
  endOffset: number | null;
};

const fileIndexCache = new Map<string, Map<string, NdjsonStatement[]>>();

/**
 * data/minutes/{year}/{municipalityCode}/statements.ndjson から
 * 指定 meetingId の発言を読み込む。startOffset 昇順にソートして返す。
 *
 * heldOn の年から対象ディレクトリを優先的に探索し、見つからなければ
 * 同 municipalityCode 配下の全年ディレクトリを探索する。
 */
export async function readStatementsForMeeting(params: {
  dataDir: string;
  municipalityCode: string;
  heldOn: string | null;
  meetingId: string;
}): Promise<NdjsonStatement[]> {
  const { dataDir, municipalityCode, heldOn, meetingId } = params;
  const yearDirs = resolveCandidateYearDirs(dataDir, municipalityCode, heldOn);
  const searched: string[] = [];
  for (const dir of yearDirs) {
    const file = resolve(dir, "statements.ndjson");
    if (!existsSync(file)) continue;
    searched.push(file);
    const index = await loadFileIndex(file);
    const hits = index.get(meetingId);
    if (hits && hits.length > 0) {
      return sortByStartOffset(hits);
    }
  }
  const detail = searched.length > 0 ? ` (searched: ${searched.join(", ")})` : "";
  throw new Error(
    `statements not found in NDJSON for meetingId=${meetingId} municipalityCode=${municipalityCode}${detail}`,
  );
}

function resolveCandidateYearDirs(
  dataDir: string,
  municipalityCode: string,
  heldOn: string | null,
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const pushIfUnseen = (dir: string) => {
    if (!seen.has(dir)) {
      seen.add(dir);
      candidates.push(dir);
    }
  };

  if (heldOn) {
    const year = heldOn.slice(0, 4);
    if (/^\d{4}$/.test(year)) {
      pushIfUnseen(resolve(dataDir, year, municipalityCode));
    }
  }

  if (!existsSync(dataDir)) return candidates;
  for (const entry of readdirSync(dataDir)) {
    if (!/^\d{4}$/.test(entry)) continue;
    const dir = resolve(dataDir, entry, municipalityCode);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      pushIfUnseen(dir);
    }
  }
  return candidates;
}

async function loadFileIndex(file: string): Promise<Map<string, NdjsonStatement[]>> {
  const cached = fileIndexCache.get(file);
  if (cached) return cached;

  const index = new Map<string, NdjsonStatement[]>();
  for await (const line of createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  })) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = JSON.parse(trimmed) as NdjsonStatement;
    const bucket = index.get(row.meetingId);
    if (bucket) {
      bucket.push(row);
    } else {
      index.set(row.meetingId, [row]);
    }
  }
  fileIndexCache.set(file, index);
  return index;
}

function sortByStartOffset(stmts: NdjsonStatement[]): NdjsonStatement[] {
  return [...stmts].sort((a, b) => {
    const ao = a.startOffset ?? Number.POSITIVE_INFINITY;
    const bo = b.startOffset ?? Number.POSITIVE_INFINITY;
    return ao - bo;
  });
}
