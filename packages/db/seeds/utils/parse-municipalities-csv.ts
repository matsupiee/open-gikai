import { readFileSync } from "node:fs";

export interface MunicipalityRow {
  code: string;
  name: string;
  prefecture: string;
  baseUrl: string | null;
  population: number | null;
  populationYear: number | null;
}

/**
 * municipalities.csv を読み込み、INSERT 用の行データを返す。
 */
export function parseMunicipalitiesCsv(csvPath: string): MunicipalityRow[] {
  const csvContent = readFileSync(csvPath, "utf-8");
  return parseMunicipalitiesCsvContent(csvContent);
}

/**
 * municipalities.csv の内容文字列をパースする（テスト用に分離）。
 */
export function parseMunicipalitiesCsvContent(csvContent: string): MunicipalityRow[] {
  const csvLines = csvContent.split(/\r?\n/).slice(1);
  return csvLines.flatMap((line) => {
    if (!line.trim()) return [];
    const cols = line.split(",");
    const code = cols[0]?.trim() ?? "";
    const prefecture = cols[1]?.replace(/"/g, "").trim() ?? "";
    const name = cols[2]?.replace(/"/g, "").trim() || prefecture;
    const baseUrl = cols[5]?.replace(/"/g, "").trim() || null;
    const populationRaw = cols[6]?.replace(/"/g, "").trim();
    const populationYearRaw = cols[7]?.replace(/"/g, "").trim();
    const population = populationRaw ? parseInt(populationRaw, 10) || null : null;
    const populationYear = populationYearRaw ? parseInt(populationYearRaw, 10) || null : null;
    return [{ code, name, prefecture, baseUrl, population, populationYear }];
  });
}
