import { scrapeNdl } from "./scrapers/ndl";
import { scrapeLocal } from "./scrapers/local";
import { writeCsv } from "./utils/csv-writer";
import { writeApi } from "./utils/api-writer";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

interface Config {
  source: "ndl" | "local";
  from: string;
  until: string;
  prefecture?: string;
  municipality?: string;
  output?: string;
}

/**
 * Read config from environment variables
 */
function readEnv(): Partial<Config> {
  const source = process.env.SCRAPER_SOURCE;
  return {
    source: source === "ndl" || source === "local" ? source : undefined,
    from: process.env.SCRAPER_FROM,
    until: process.env.SCRAPER_UNTIL,
    prefecture: process.env.SCRAPER_PREFECTURE,
    municipality: process.env.SCRAPER_MUNICIPALITY,
    output: process.env.SCRAPER_OUTPUT,
  };
}

/**
 * Parse command line arguments (override env vars)
 */
function parseCli(): Partial<Config> {
  const args = process.argv.slice(2);
  const parsed: Partial<Config> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--source" && i + 1 < args.length) {
      const value = args[i + 1];
      if (value === "ndl" || value === "local") parsed.source = value;
      i++;
    } else if (arg === "--from" && i + 1 < args.length) {
      parsed.from = args[i + 1];
      i++;
    } else if (arg === "--until" && i + 1 < args.length) {
      parsed.until = args[i + 1];
      i++;
    } else if (arg === "--prefecture" && i + 1 < args.length) {
      parsed.prefecture = args[i + 1];
      i++;
    } else if (arg === "--municipality" && i + 1 < args.length) {
      parsed.municipality = args[i + 1];
      i++;
    } else if (arg === "--output" && i + 1 < args.length) {
      parsed.output = args[i + 1];
      i++;
    }
  }

  return parsed;
}

/**
 * Merge env and CLI config (CLI takes precedence)
 */
function loadConfig(): Partial<Config> {
  const env = readEnv();
  const cli = parseCli();
  return { ...env, ...Object.fromEntries(Object.entries(cli).filter(([, v]) => v !== undefined)) };
}

/**
 * Validate config and normalize date fields in-place
 */
function validateConfig(config: Partial<Config>): { valid: boolean; error?: string } {
  if (!config.source) {
    return { valid: false, error: "SCRAPER_SOURCE (or --source) is required (ndl or local)" };
  }

  if (config.source === "ndl") {
    if (!config.from) {
      return { valid: false, error: "SCRAPER_FROM (or --from) is required for NDL scraper" };
    }
    if (!isValidYearMonth(config.from)) {
      return { valid: false, error: "SCRAPER_FROM must be in YYYY-MM format" };
    }
    if (!config.until) {
      config.until = config.from;
    } else if (!isValidYearMonth(config.until)) {
      return { valid: false, error: "SCRAPER_UNTIL must be in YYYY-MM format" };
    }
    config.from = `${config.from}-01`;
    config.until = `${config.until}-31`;
  }

  if (config.source === "local") {
    if (!config.prefecture && !config.municipality) {
      return {
        valid: false,
        error: "At least one of SCRAPER_PREFECTURE or SCRAPER_MUNICIPALITY is required for local scraper",
      };
    }
  }

  return { valid: true };
}

function isValidYearMonth(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(dateStr)) return false;
  const [, month = "0"] = dateStr.split("-");
  const monthNum = parseInt(month, 10);
  return monthNum >= 1 && monthNum <= 12;
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function defaultOutputPath(config: Config): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const outputDir = join(__dirname, "../output");

  if (config.source === "ndl") {
    const from = config.from.slice(0, 7);
    const until = config.until.slice(0, 7);
    const filename = from === until ? `ndl_${from}.csv` : `ndl_${from}_${until}.csv`;
    return join(outputDir, filename);
  }

  const parts = ["local"];
  if (config.prefecture) parts.push(config.prefecture);
  if (config.municipality) parts.push(config.municipality);
  return join(outputDir, `${parts.join("_")}.csv`);
}

async function main(): Promise<void> {
  try {
    console.log("=== Open Gikai Scraper ===\n");

    const config = loadConfig();
    const validation = validateConfig(config);

    if (!validation.valid) {
      console.error(`\nError: ${validation.error}`);
      console.log("\nConfigure via .env file or CLI arguments:");
      console.log("  NDL:   SCRAPER_SOURCE=ndl SCRAPER_FROM=YYYY-MM [SCRAPER_UNTIL=YYYY-MM]");
      console.log("  Local: SCRAPER_SOURCE=local [SCRAPER_PREFECTURE=都道府県] [SCRAPER_MUNICIPALITY=市町村]");
      process.exit(1);
    }

    const typedConfig = config as Config;
    console.log("Starting scraper with config:", typedConfig);
    console.log("");

    const limit = parseLimit(process.env.SCRAPER_LIMIT);
    if (limit !== undefined) {
      console.log(`[Limit] SCRAPER_LIMIT=${limit} (test mode)`);
    }

    let records;
    if (typedConfig.source === "ndl") {
      records = await scrapeNdl({ from: typedConfig.from, until: typedConfig.until, limit });
    } else {
      records = await scrapeLocal({
        prefecture: typedConfig.prefecture,
        municipality: typedConfig.municipality,
        limit,
      });
    }

    const ingestApiUrl = process.env.INGEST_API_URL;
    const ingestApiKey = process.env.INGEST_API_KEY;

    if (ingestApiUrl && ingestApiKey) {
      console.log(`\n[API] Sending ${records.length} records to ${ingestApiUrl} ...`);
      await writeApi(records, { apiUrl: ingestApiUrl, apiKey: ingestApiKey });
    } else {
      const outputPath = typedConfig.output ?? defaultOutputPath(typedConfig);
      writeCsv(records, outputPath);
    }

    console.log("\n=== Scraper Complete ===");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
