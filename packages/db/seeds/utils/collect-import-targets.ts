import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isAlreadyImported } from "./complete-marker";

export interface ImportTarget {
  codeDir: string;
  meetingsPath: string;
  statementsPath: string | null;
}

/**
 * data/minutes/ 配下の {year}/{municipalityCode}/ ディレクトリを走査し、
 * _complete が存在し、かつ imported フラグが立っていないディレクトリを返す。
 */
export function collectImportTargets(dataDir: string): ImportTarget[] {
  const targets: ImportTarget[] = [];

  if (!existsSync(dataDir)) return targets;

  for (const yearEntry of readdirSync(dataDir)) {
    const yearDir = resolve(dataDir, yearEntry);
    if (!statSync(yearDir).isDirectory() || !/^\d{4}$/.test(yearEntry)) continue;

    for (const codeEntry of readdirSync(yearDir)) {
      const codeDir = resolve(yearDir, codeEntry);
      if (!statSync(codeDir).isDirectory()) continue;

      const completePath = resolve(codeDir, "_complete");
      if (!existsSync(completePath)) continue;
      if (isAlreadyImported(codeDir)) continue;

      const meetingsPath = resolve(codeDir, "meetings.ndjson");
      if (!existsSync(meetingsPath)) continue;

      const statementsPath = resolve(codeDir, "statements.ndjson");

      targets.push({
        codeDir,
        meetingsPath,
        statementsPath: existsSync(statementsPath) ? statementsPath : null,
      });
    }
  }

  return targets;
}
