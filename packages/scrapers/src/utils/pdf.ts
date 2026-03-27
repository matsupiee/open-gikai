import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  extractText as ExtractTextFn,
  getDocumentProxy as GetDocumentProxyFn,
} from "unpdf";

const PDFJS_VERSION = "5.4.296";
const CMAP_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;
const PDFTEXT_MAX_BUFFER = 25_000_000;
const execFileAsync = promisify(execFile);
let unpdfModulePromise: Promise<typeof import("unpdf")> | null = null;

async function getUnpdfModule(): Promise<typeof import("unpdf")> {
  unpdfModulePromise ??= import("unpdf");
  return unpdfModulePromise;
}

export const getDocumentProxy: GetDocumentProxyFn = async (data, options) => {
  const { getDocumentProxy: _getDocumentProxy } = await getUnpdfModule();
  return _getDocumentProxy(data, {
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    ...options,
  });
};

export const extractText: ExtractTextFn = async (...args) => {
  const { extractText: _extractText } = await getUnpdfModule();
  return _extractText(...args);
};

export type PdfTextExtractMethod = "unpdf" | "pdftotext";

export interface ExtractPdfTextOptions {
  isUsable?: (text: string) => boolean;
  maxBuffer?: number;
  pdfUrl?: string;
  strategy?: PdfTextExtractMethod | readonly PdfTextExtractMethod[];
  tempPrefix?: string;
}

function toMethodList(
  strategy?: PdfTextExtractMethod | readonly PdfTextExtractMethod[],
): PdfTextExtractMethod[] {
  if (!strategy) return ["unpdf"];
  return Array.isArray(strategy) ? [...strategy] : [strategy];
}

function isUsableText(
  text: string | null,
  isUsable?: (text: string) => boolean,
): text is string {
  if (!text || text.trim().length === 0) return false;
  return isUsable ? isUsable(text) : true;
}

export async function extractPdfTextWithUnpdf(
  buffer: ArrayBuffer,
  options?: Pick<ExtractPdfTextOptions, "pdfUrl">,
): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim().length > 0 ? text : null;
  } catch (err) {
    console.warn(
      `[pdf] unpdf extract failed: ${options?.pdfUrl ?? "(unknown pdf)"}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function extractPdfTextWithPdftotext(
  buffer: ArrayBuffer,
  options?: Pick<ExtractPdfTextOptions, "maxBuffer" | "pdfUrl" | "tempPrefix">,
): Promise<string | null> {
  const tmpPath = join(
    tmpdir(),
    `${options?.tempPrefix ?? "pdf"}_${Date.now()}.pdf`,
  );

  try {
    await writeFile(tmpPath, Buffer.from(buffer));
    const { stdout } = await execFileAsync("pdftotext", ["-layout", tmpPath, "-"], {
      maxBuffer: options?.maxBuffer ?? PDFTEXT_MAX_BUFFER,
    });
    return stdout.trim().length > 0 ? stdout : null;
  } catch (err) {
    console.warn(
      `[pdf] pdftotext failed: ${options?.pdfUrl ?? "(unknown pdf)"}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function extractPdfText(
  buffer: ArrayBuffer,
  options?: ExtractPdfTextOptions,
): Promise<string | null> {
  const methods = toMethodList(options?.strategy);
  const backup = methods.length > 1 ? buffer.slice(0) : null;
  let lastText: string | null = null;

  for (let index = 0; index < methods.length; index++) {
    const method = methods[index]!;
    const methodBuffer =
      index === 0 ? buffer : backup instanceof ArrayBuffer ? backup.slice(0) : buffer;

    const text =
      method === "pdftotext"
        ? await extractPdfTextWithPdftotext(methodBuffer, options)
        : await extractPdfTextWithUnpdf(methodBuffer, options);

    if (isUsableText(text, options?.isUsable)) {
      return text;
    }

    if (text) lastText = text;
  }

  return lastText;
}
