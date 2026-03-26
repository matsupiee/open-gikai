import { createWriteStream, existsSync, mkdirSync, type WriteStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ScrapeLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface ScrapeRunLogger {
  log: ScrapeLogger;
  logStream: WriteStream;
  logDir: string;
  ndjsonDir: string;
  endLog: () => Promise<void>;
}

/**
 * ログディレクトリ・NDJSON 出力ディレクトリを確保し、ファイル＋コンソールへ書く log を返す。
 */
export function createScrapeRunLogger(scriptImportMetaUrl: string, root: string): ScrapeRunLogger {
  const today = new Date().toISOString().slice(0, 10);
  const scriptPath = fileURLToPath(scriptImportMetaUrl);
  const logDir = resolve(scriptPath, "../../output", today);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  const ndjsonDir = resolve(root, "data/minutes");
  if (!existsSync(ndjsonDir)) {
    mkdirSync(ndjsonDir, { recursive: true });
  }

  const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logStream = createWriteStream(resolve(logDir, `scrape-${runTimestamp}.log`));

  const write = (level: "INFO" | "WARN" | "ERROR", args: unknown[]) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${args.map(String).join(" ")}`;

    if (level === "ERROR") {
      console.error(line);
    } else if (level === "WARN") {
      console.warn(line);
    } else {
      console.log(line);
    }

    logStream.write(line + "\n");
  };

  const log: ScrapeLogger = {
    info: (...args) => write("INFO", args),
    warn: (...args) => write("WARN", args),
    error: (...args) => write("ERROR", args),
  };

  const endLog = () => new Promise<void>((r) => logStream.end(r));

  return { log, logStream, logDir, ndjsonDir, endLog };
}
