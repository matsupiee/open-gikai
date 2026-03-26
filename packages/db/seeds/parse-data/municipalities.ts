import { readFileSync } from "node:fs";

import type { RegionSlug } from "../../../../src/schema/municipalities";
import { prefectureToRegionSlug } from "../../utils/region";

export { prefectureToRegionSlug };

type MunicipalityCsvRow = {
  code: string;
  prefecture: string;
  name: string;
  baseUrl: string;
  population: number | null;
  populationYear: number | null;
};

function parseMunicipalitiesCsv(filePath: string): MunicipalityCsvRow[] {
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
    return { code, prefecture, name, baseUrl, population, populationYear };
  });
}

/** CSV から組み立てた自治体行（DB 不要・code が主キー／meetings.municipalityCode と同一） */
export type MunicipalityRow = MunicipalityCsvRow & {
  regionSlug: RegionSlug;
  enabled: boolean;
};

export function municipalityRowsFromCsv(csvPath: string): MunicipalityRow[] {
  const csvRows = parseMunicipalitiesCsv(csvPath);

  return csvRows.map((m) => ({
    ...m,
    name: m.name || m.prefecture, // 都道府県の場合は自治体名が空になっているため
    regionSlug: prefectureToRegionSlug(m.prefecture),
    enabled: true,
  }));
}
