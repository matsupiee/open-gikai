import { readFileSync } from "node:fs";

import { type RegionSlug } from "../../schema/municipalities";

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

const REGION_TO_PREFECTURES: Record<RegionSlug, string[]> = {
  hokkaido: ["北海道"],
  tohoku: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  kanto: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  chubu: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"],
  kinki: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  chugoku: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  shikoku: ["徳島県", "香川県", "愛媛県", "高知県"],
  kyushu: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"],
} as const;

const PREFECTURE_TO_REGION_SLUG: Record<string, RegionSlug> = Object.fromEntries(
  (Object.entries(REGION_TO_PREFECTURES) as [RegionSlug, readonly string[]][]).flatMap(
    ([slug, prefs]) => prefs.map((p) => [p, slug]),
  ),
) as Record<string, RegionSlug>;

export function prefectureToRegionSlug(prefecture: string): RegionSlug {
  const slug = PREFECTURE_TO_REGION_SLUG[prefecture];
  if (!slug) {
    throw new Error(
      `[parse-data/municipality] 都道府県「${prefecture}」に対応する regionSlug がありません`,
    );
  }
  return slug;
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
