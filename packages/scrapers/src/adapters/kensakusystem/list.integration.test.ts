import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi, afterEach } from "vitest";
import {
  extractDate,
  stripHtmlTags,
  normalizeFullWidth,
} from "./shared";

vi.mock("./shared", () => {
  // shared の pure 関数は実際のロジックを使い、fetch 系のみモックする
  function normalizeFullWidth(str: string): string {
    return str.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
  }

  function extractDate(text: string): string | null {
    const normalized = normalizeFullWidth(text);
    const wareki: Record<string, number> = {
      令和: 2018,
      平成: 1988,
      昭和: 1925,
    };
    for (const [era, base] of Object.entries(wareki)) {
      const m = normalized.match(
        new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
      );
      if (m) {
        const year = base + Number(m[1]);
        const month = String(m[2]).padStart(2, "0");
        const day = String(m[3]).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
    const western = normalized.match(
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    );
    if (western) {
      return `${western[1]}-${String(western[2]).padStart(2, "0")}-${String(western[3]).padStart(2, "0")}`;
    }
    return null;
  }

  function stripHtmlTags(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  function detectMeetingType(text: string): string {
    if (text.includes("委員会")) return "committee";
    if (text.includes("臨時会")) return "extraordinary";
    return "plenary";
  }

  return {
    USER_AGENT: "test",
    normalizeFullWidth,
    extractDate,
    stripHtmlTags,
    detectMeetingType,
    fetchWithEncoding: vi.fn(),
    fetchWithEncodingPost: vi.fn(),
    fetchRawBytes: vi.fn(),
    fetchRawBytesPost: vi.fn(),
    decodeShiftJis: vi.fn(),
    percentEncodeBytes: vi.fn(),
    extractTreedepthRawBytes: vi.fn(() => []),
  };
});

import {
  fetchFromSapphire,
  fetchFromCgi,
  fetchFromIndexHtml,
} from "./list";
import {
  fetchWithEncoding,
  fetchRawBytes,
  decodeShiftJis,
  extractTreedepthRawBytes,
  fetchRawBytesPost,
  percentEncodeBytes,
} from "./shared";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- See.exe リンク検出テスト（実データ） ---

describe("See.exe link detection with real fixtures", () => {
  test("sapphire: sapphire.html に See.exe リンクがある", () => {
    const html = fixture("sapphire", "top.html");
    const seeExeMatch = html.match(
      /href=["']([^"']*See\.exe[^"']*)[\"']/i
    );
    expect(seeExeMatch).not.toBeNull();
    expect(seeExeMatch![1]).toContain("See.exe");
    expect(seeExeMatch![1]).toContain("Code=");
  });

  test("cgi: Search2.exe ページに See.exe リンクがある", () => {
    const html = fixture("cgi", "top.html");
    const seeExeMatch = html.match(
      /href=["']([^"']*See\.exe[^"']*)[\"']/i
    );
    expect(seeExeMatch).not.toBeNull();
    expect(seeExeMatch![1]).toContain("See.exe");
    expect(seeExeMatch![1]).toContain("Code=");
  });

  test("index-html: index.html に See.exe リンクがある", () => {
    const html = fixture("index-html", "top.html");
    const seeExeMatch = html.match(
      /href=["']([^"']*See\.exe[^"']*)[\"']/i
    );
    expect(seeExeMatch).not.toBeNull();
    expect(seeExeMatch![1]).toContain("See.exe");
    expect(seeExeMatch![1]).toContain("Code=");
  });
});

describe("tree page treedepth structure with real fixtures", () => {
  test("sapphire: tree.html に viewtree フォームと treedepth ラベルがある", () => {
    const html = fixture("sapphire", "tree.html");
    expect(html).toContain('name="viewtree"');
    expect(html).toContain("令和");
  });

  test("cgi: tree.html に viewtree フォームと treedepth ラベルがある", () => {
    const html = fixture("cgi", "tree.html");
    expect(html).toContain('name="viewtree"');
    expect(html).toContain("令和");
  });

  test("index-html: tree.html に viewtree フォームと treedepth ラベルがある", () => {
    const html = fixture("index-html", "tree.html");
    expect(html).toContain('name="viewtree"');
    expect(html).toContain("令和");
  });
});

// --- fetchFrom* 統合テスト（実データ top.html + mocked shared） ---

describe("fetchFromSapphire integration with real top page", () => {
  const mockFetchRawBytes = fetchRawBytes as ReturnType<typeof vi.fn>;
  const mockDecodeShiftJis = decodeShiftJis as ReturnType<typeof vi.fn>;
  const mockExtractTreedepthRawBytes = extractTreedepthRawBytes as ReturnType<
    typeof vi.fn
  >;
  const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
  const mockPercentEncodeBytes = percentEncodeBytes as ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("sapphire: 目黒区の sapphire.html から See.exe ツリーページを辿る", async () => {
    const topHtml = fixture("sapphire", "top.html");
    const treeHtml = fixture("sapphire", "tree.html");

    // 1回目: sapphire.html → See.exe リンク発見
    mockFetchRawBytes
      .mockResolvedValueOnce(new Uint8Array([0x41])) // sapphire.html
      .mockResolvedValueOnce(new Uint8Array([0x42])); // See.exe tree page

    mockDecodeShiftJis
      .mockReturnValueOnce(topHtml)
      .mockReturnValueOnce(treeHtml);

    // treedepth なし（top page）→ See.exe リンクをフォロー → treedepth あり（tree page）
    mockExtractTreedepthRawBytes
      .mockReturnValueOnce([]) // sapphire.html にはない
      .mockReturnValueOnce([new Uint8Array([0x97, 0xdf])]) // tree page の年タブ
      .mockReturnValueOnce([new Uint8Array([0x97, 0xdf])]) // navigateTreedepths
      .mockReturnValue([]);

    mockFetchRawBytesPost.mockResolvedValue(new Uint8Array([0x43]));
    mockPercentEncodeBytes.mockReturnValue("%97%df");

    // POST レスポンスに ResultFrame リンクを含める
    mockDecodeShiftJis.mockReturnValueOnce(
      `<html><a href="ResultFrame.exe?Code=hxcvax8v0tgrybompl&amp;fileName=R070217A&amp;startPos=0">2月17日</a></html>`
    );

    const result = await fetchFromSapphire(
      "http://www.kensakusystem.jp/meguro/sapphire.html"
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    expect(result![0]!.heldOn).toBe("2025-02-17");
    // sapphire.html + See.exe tree page の2回フェッチ
    expect(mockFetchRawBytes).toHaveBeenCalledTimes(2);
  });
});

describe("fetchFromCgi integration with real top page", () => {
  const mockFetchWithEncoding = fetchWithEncoding as ReturnType<typeof vi.fn>;
  const mockFetchRawBytes = fetchRawBytes as ReturnType<typeof vi.fn>;
  const mockDecodeShiftJis = decodeShiftJis as ReturnType<typeof vi.fn>;
  const mockExtractTreedepthRawBytes = extractTreedepthRawBytes as ReturnType<
    typeof vi.fn
  >;
  const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
  const mockPercentEncodeBytes = percentEncodeBytes as ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("cgi: 葛飾区の Search2.exe から sapphire フォールバックを経由してツリーに到達", async () => {
    const topHtml = fixture("cgi", "top.html");
    const treeHtml = fixture("cgi", "tree.html");

    // fetchFromCgi: fetchWithEncoding で top page 取得（日付つき See.exe リンクなし → sapphire フォールバック）
    mockFetchWithEncoding.mockResolvedValueOnce(topHtml);

    // fetchFromSapphire: fetchRawBytes で baseUrl 取得 → See.exe リンク発見
    mockFetchRawBytes
      .mockResolvedValueOnce(new Uint8Array([0x41])) // Search2.exe page
      .mockResolvedValueOnce(new Uint8Array([0x42])); // See.exe tree page

    mockDecodeShiftJis
      .mockReturnValueOnce(topHtml)
      .mockReturnValueOnce(treeHtml);

    mockExtractTreedepthRawBytes
      .mockReturnValueOnce([]) // Search2.exe にはない
      .mockReturnValueOnce([new Uint8Array([0x97, 0xdf])])
      .mockReturnValueOnce([new Uint8Array([0x97, 0xdf])])
      .mockReturnValue([]);

    mockFetchRawBytesPost.mockResolvedValue(new Uint8Array([0x43]));
    mockPercentEncodeBytes.mockReturnValue("%97%df");

    mockDecodeShiftJis.mockReturnValueOnce(
      `<html><a href="ResultFrame.exe?Code=n9goyxzrwrkcenlj8f&amp;fileName=R070214A&amp;startPos=0">2月14日</a></html>`
    );

    const result = await fetchFromCgi(
      "http://www.kensakusystem.jp/katsushika/cgi-bin3/Search2.exe?Code=n9goyxzrwrkcenlj8f&sTarget=2"
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    expect(result![0]!.heldOn).toBe("2025-02-14");
  });
});

describe("fetchFromIndexHtml integration with real top page", () => {
  const mockFetchWithEncoding = fetchWithEncoding as ReturnType<typeof vi.fn>;
  const mockFetchRawBytes = fetchRawBytes as ReturnType<typeof vi.fn>;
  const mockDecodeShiftJis = decodeShiftJis as ReturnType<typeof vi.fn>;
  const mockExtractTreedepthRawBytes = extractTreedepthRawBytes as ReturnType<
    typeof vi.fn
  >;
  const mockFetchRawBytesPost = fetchRawBytesPost as ReturnType<typeof vi.fn>;
  const mockPercentEncodeBytes = percentEncodeBytes as ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("index-html: 弘前市の index.html から sapphire フォールバックを経由してツリーに到達", async () => {
    const topHtml = fixture("index-html", "top.html");
    const treeHtml = fixture("index-html", "tree.html");

    mockFetchWithEncoding.mockResolvedValueOnce(topHtml);

    mockFetchRawBytes
      .mockResolvedValueOnce(new Uint8Array([0x41]))
      .mockResolvedValueOnce(new Uint8Array([0x42]));

    mockDecodeShiftJis
      .mockReturnValueOnce(topHtml)
      .mockReturnValueOnce(treeHtml);

    mockExtractTreedepthRawBytes
      .mockReturnValueOnce([])
      .mockReturnValueOnce([new Uint8Array([0x97, 0xdf])])
      .mockReturnValueOnce([new Uint8Array([0x97, 0xdf])])
      .mockReturnValue([]);

    mockFetchRawBytesPost.mockResolvedValue(new Uint8Array([0x43]));
    mockPercentEncodeBytes.mockReturnValue("%97%df");

    mockDecodeShiftJis.mockReturnValueOnce(
      `<html><a href="ResultFrame.exe?Code=jdos47sfsd973gseoq&amp;fileName=R050217A&amp;startPos=0">2月17日</a></html>`
    );

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/hirosaki/index.html"
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(1);
    expect(result![0]!.heldOn).toBe("2023-02-17");
  });
});
