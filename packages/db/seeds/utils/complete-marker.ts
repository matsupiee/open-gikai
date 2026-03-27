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
