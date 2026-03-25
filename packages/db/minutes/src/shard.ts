import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as schema from "./schema";
import type { RegionSlug } from "./schema/municipalities";
import type { Db } from "./index";

// --- Prefecture → Region mapping ---

const REGION_TO_PREFECTURES: Record<RegionSlug, readonly string[]> = {
  hokkaido: ["北海道"],
  tohoku: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  kanto: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  chubu: [
    "新潟県",
    "富山県",
    "石川県",
    "福井県",
    "山梨県",
    "長野県",
    "岐阜県",
    "静岡県",
    "愛知県",
  ],
  kinki: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  chugoku: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  shikoku: ["徳島県", "香川県", "愛媛県", "高知県"],
  kyushu: [
    "福岡県",
    "佐賀県",
    "長崎県",
    "熊本県",
    "大分県",
    "宮崎県",
    "鹿児島県",
    "沖縄県",
  ],
};

const PREFECTURE_TO_REGION: Record<string, RegionSlug> = Object.fromEntries(
  (
    Object.entries(REGION_TO_PREFECTURES) as [RegionSlug, readonly string[]][]
  ).flatMap(([slug, prefs]) => prefs.map((p) => [p, slug])),
) as Record<string, RegionSlug>;

export function prefectureToRegion(prefecture: string): RegionSlug | undefined {
  return PREFECTURE_TO_REGION[prefecture];
}

// --- Manifest type ---

type Manifest = {
  index: { path: string; size: number };
  minutes: Record<string, Record<string, Array<{ path: string; size: number }>>>;
};

// --- Shard filter ---

export interface ShardFilter {
  heldOnFrom?: string;
  heldOnTo?: string;
  prefecture?: string;
}

// --- ShardedMinutesDb ---

/**
 * manifest.json を読み込み、フィルタ条件に応じて適切なシャードの Db を返す。
 *
 * 各シャードは `minutes/{year}/{region}.db` に対応する。
 * フィルタで年・地方を絞り込めない場合は全シャードを返す。
 */
export class ShardedMinutesDb {
  private manifest: Manifest;
  private baseDir: string;
  private dbCache = new Map<string, Db>();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.manifest = JSON.parse(
      readFileSync(join(baseDir, "manifest.json"), "utf-8"),
    );
  }

  /**
   * フィルタ条件にマッチするシャードの Db 一覧を返す。
   * - heldOnFrom/heldOnTo → 対象年の絞り込み
   * - prefecture → 対象地方の絞り込み
   */
  getRelevantDbs(filter?: ShardFilter): Db[] {
    const years = this.resolveYears(filter?.heldOnFrom, filter?.heldOnTo);
    const region = filter?.prefecture
      ? prefectureToRegion(filter.prefecture)
      : undefined;

    const paths: string[] = [];
    for (const year of years) {
      const yearShards = this.manifest.minutes[year];
      if (!yearShards) continue;
      for (const [r, shards] of Object.entries(yearShards)) {
        if (region && r !== region) continue;
        for (const shard of shards) {
          paths.push(shard.path);
        }
      }
    }

    if (paths.length === 0) return [];
    return paths.map((p) => this.openDb(p));
  }

  /** 全シャードの Db を返す */
  getAllDbs(): Db[] {
    const paths: string[] = [];
    for (const yearShards of Object.values(this.manifest.minutes)) {
      for (const shards of Object.values(yearShards)) {
        for (const shard of shards) {
          paths.push(shard.path);
        }
      }
    }
    return paths.map((p) => this.openDb(p));
  }

  /** index.sqlite の Db を返す（自治体マスタ用） */
  getIndexDb(): Db {
    return this.openDb(this.manifest.index.path);
  }

  private openDb(relativePath: string): Db {
    const cached = this.dbCache.get(relativePath);
    if (cached) return cached;

    const fullPath = join(this.baseDir, relativePath);
    const sqlite = new Database(fullPath, { readonly: true });
    sqlite.run("PRAGMA journal_mode = WAL;");
    sqlite.run("PRAGMA foreign_keys = ON;");
    const db = drizzle(sqlite, { schema, casing: "snake_case" });
    this.dbCache.set(relativePath, db);
    return db;
  }

  private resolveYears(from?: string, to?: string): string[] {
    const allYears = Object.keys(this.manifest.minutes).sort();
    if (allYears.length === 0) return [];
    if (!from && !to) return allYears;

    const fromYear = from ? from.slice(0, 4) : allYears[0]!;
    const toYear = to ? to.slice(0, 4) : allYears[allYears.length - 1]!;

    return allYears.filter((y) => y >= fromYear && y <= toYear);
  }
}
