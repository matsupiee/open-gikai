import { readFileSync } from "node:fs";

type MunicipalityCsvRow = {
  code: string;
  prefecture: string;
  name: string;
  baseUrl: string;
  population: number | null;
  populationYear: number | null;
};

export function parseMunicipalitiesCsv(filePath: string): MunicipalityCsvRow[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).slice(1);

  return lines.flatMap((line) => {
    if (!line.trim()) return [];

    const cols = line.split(",");
    const code = cols[0]?.trim() ?? "";
    const prefecture = cols[1]?.replace(/"/g, "").trim() ?? "";
    const name = cols[2]?.replace(/"/g, "").trim() ?? "";
    const baseUrl = (cols[5]?.replace(/"/g, "").trim() ?? "") || "";
    const populationRaw = cols[6]?.replace(/"/g, "").trim();
    const populationYearRaw = cols[7]?.replace(/"/g, "").trim();
    const population = populationRaw ? parseInt(populationRaw, 10) || null : null;
    const populationYear = populationYearRaw ? parseInt(populationYearRaw, 10) || null : null;
    return { code, prefecture, name: name || prefecture, baseUrl, population, populationYear };
  });
}
