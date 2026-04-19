import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * _complete ファイルを読み取り、imported フラグが立っているか確認する。
 */
export function isAlreadyImported(codeDir: string): boolean {
  const completePath = resolve(codeDir, "_complete");
  if (!existsSync(completePath)) return false;
  try {
    const data = JSON.parse(readFileSync(completePath, "utf-8"));
    return data.imported === true;
  } catch {
    return false;
  }
}

/**
 * _complete ファイルに imported フラグを書き込む。
 */
export function markAsImported(codeDir: string): void {
  const completePath = resolve(codeDir, "_complete");
  const data = JSON.parse(readFileSync(completePath, "utf-8"));
  data.imported = true;
  data.importedAt = new Date().toISOString();
  writeFileSync(completePath, JSON.stringify(data) + "\n");
}

/**
 * _summaries_complete ファイルを読み取り、summariesImported フラグが立っているか確認する。
 * summaries.ndjson の import 履歴は meetings.ndjson とは独立に管理する。
 */
export function isSummariesAlreadyImported(codeDir: string): boolean {
  const path = resolve(codeDir, "_summaries_complete");
  if (!existsSync(path)) return false;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return data.summariesImported === true;
  } catch {
    return false;
  }
}

/**
 * _summaries_complete ファイルに summariesImported フラグを書き込む。
 */
export function markSummariesAsImported(codeDir: string): void {
  const path = resolve(codeDir, "_summaries_complete");
  writeFileSync(
    path,
    JSON.stringify({ summariesImported: true, importedAt: new Date().toISOString() }) + "\n",
  );
}
