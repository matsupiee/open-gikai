import { SharedSystemAdapterKey } from "./scrapers";

export const CUSTOM_SYSTEM_TYPE = "custom" as const;
export type SystemTypeFilter = SharedSystemAdapterKey | typeof CUSTOM_SYSTEM_TYPE;

export function parseYear(): number | undefined {
  const idx = process.argv.indexOf("--year");
  if (idx === -1) return undefined;
  const val = Number(process.argv[idx + 1]);
  if (Number.isNaN(val) || val < 2000 || val > 2100) {
    console.error(`[scrape-to-ndjson] 無効な年: ${process.argv[idx + 1]}`);
    process.exit(1);
  }
  return val;
}

export function parseMeetingLimit(): number | undefined {
  const idx = process.argv.indexOf("--meeting-limit");
  if (idx === -1) return undefined;
  const val = Number(process.argv[idx + 1]);
  if (Number.isNaN(val) || val < 1) {
    console.error(`[scrape-to-ndjson] 無効な meeting-limit: ${process.argv[idx + 1]}`);
    process.exit(1);
  }
  return val;
}

export function parseTarget(): string[] | undefined {
  const idx = process.argv.indexOf("--target");
  if (idx === -1) return undefined;
  const val = process.argv[idx + 1];
  if (!val) {
    console.error(
      `[scrape-to-ndjson] --target に自治体コードを指定してください（カンマ区切りで複数指定可）`,
    );
    process.exit(1);
  }
  return val.split(",").map((s) => s.trim());
}

const validSystemTypes: string[] = [...Object.values(SharedSystemAdapterKey), CUSTOM_SYSTEM_TYPE];

export function parseSystemType(): SystemTypeFilter | undefined {
  const idx = process.argv.indexOf("--system-type");
  if (idx === -1) return undefined;
  const val = process.argv[idx + 1];
  if (!val || !validSystemTypes.includes(val)) {
    console.error(`[scrape-to-ndjson] 無効なシステムタイプ: ${val}`);
    console.error(`  有効な値: ${validSystemTypes.join(", ")}`);
    process.exit(1);
  }
  return val as SystemTypeFilter;
}
