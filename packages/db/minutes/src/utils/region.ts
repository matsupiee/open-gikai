import type { RegionSlug } from "../schema/municipalities";

export const REGION_TO_PREFECTURES: Record<RegionSlug, readonly string[]> = {
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

export function prefectureToRegionSlug(prefecture: string): RegionSlug {
  const slug = PREFECTURE_TO_REGION[prefecture];
  if (!slug) {
    throw new Error(
      `都道府県「${prefecture}」に対応する regionSlug がありません`,
    );
  }
  return slug;
}
