import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isSummariesAlreadyImported } from "./complete-marker";

export interface SummaryImportTarget {
  codeDir: string;
  summariesPath: string;
}

export interface CollectSummaryOptions {
  /** true の場合、summariesImported 済みディレクトリをスキップする（本番用） */
  skipImported: boolean;
  /** 指定した場合、この自治体コードに一致するディレクトリのみ対象にする */
  municipalityCodes?: string[];
}

/**
 * data/minutes/ 配下の {year}/{municipalityCode}/ ディレクトリを走査し、
 * summaries.ndjson が存在するディレクトリを返す。
 *
 * skipImported: true の場合、_summaries_complete に summariesImported フラグが
 * 立っているディレクトリを除外する。
 */
export function collectSummaryImportTargets(
  dataDir: string,
  options: CollectSummaryOptions,
): SummaryImportTarget[] {
  const targets: SummaryImportTarget[] = [];

  if (!existsSync(dataDir)) return targets;

  for (const yearEntry of readdirSync(dataDir)) {
    const yearDir = resolve(dataDir, yearEntry);
    if (!statSync(yearDir).isDirectory() || !/^\d{4}$/.test(yearEntry)) continue;

    for (const codeEntry of readdirSync(yearDir)) {
      const codeDir = resolve(yearDir, codeEntry);
      if (!statSync(codeDir).isDirectory()) continue;

      if (options.municipalityCodes && options.municipalityCodes.length > 0) {
        if (!options.municipalityCodes.includes(codeEntry)) continue;
      }

      const summariesPath = resolve(codeDir, "summaries.ndjson");
      if (!existsSync(summariesPath)) continue;

      if (options.skipImported && isSummariesAlreadyImported(codeDir)) continue;

      targets.push({ codeDir, summariesPath });
    }
  }

  return targets;
}
