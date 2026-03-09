import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { MeetingData } from "../types";

const CSV_HEADERS: (keyof MeetingData)[] = [
  "externalId",
  "title",
  "meetingType",
  "heldOn",
  "assemblyLevel",
  "prefecture",
  "municipality",
  "sourceUrl",
  "rawText",
];

function escapeCsvField(value: string | null): string {
  if (value === null) return "";
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function writeCsv(rows: MeetingData[], outputPath: string): void {
  const headerLine = CSV_HEADERS.join(",");
  const dataLines = rows.map((row) =>
    CSV_HEADERS.map((key) => escapeCsvField(row[key] as string | null)).join(
      ","
    )
  );

  const content = [headerLine, ...dataLines].join("\n");

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
  console.log(`[CSV] Written ${rows.length} records to ${outputPath}`);
}
