import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, "../../../docs/custom-scraping");
const customAdaptersDir = join(__dirname, "adapters/custom");

function listCustomScrapingDocs(): string[] {
  return readdirSync(docsDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.replace(/\.md$/u, ""));
}

function listCustomAdapterSlugs(): string[] {
  return readdirSync(customAdaptersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.replace(/^\d+-/u, ""));
}

describe("custom scraping docs", () => {
  it("does not keep planning docs for municipalities that already have custom adapters", () => {
    const adapterSlugs = new Set(listCustomAdapterSlugs());
    const duplicates = listCustomScrapingDocs()
      .filter((docSlug) => adapterSlugs.has(docSlug))
      .sort();

    expect(
      duplicates,
      duplicates.length === 0
        ? undefined
        : `docs/custom-scraping に不要な Markdown が残っています: ${duplicates.join(", ")}`
    ).toEqual([]);
  });
});
