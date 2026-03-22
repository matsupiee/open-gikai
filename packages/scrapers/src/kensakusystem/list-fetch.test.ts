import { describe, expect, test, vi, afterEach } from "vitest";
import {
  extractDate,
  stripHtmlTags,
  normalizeFullWidth,
} from "./shared";

vi.mock("./shared", () => {
  // shared の pure 関数は実際のロジックを使い、fetch 系のみモックする
  // vi.mock はファイルトップに巻き上げられるため、ここで直接実装を埋め込む
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
    const western = normalized.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (western) {
      return `${western[1]}-${String(western[2]).padStart(2, "0")}-${String(western[3]).padStart(2, "0")}`;
    }
    return null;
  }

  function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, "");
  }

  return {
    USER_AGENT: "test",
    normalizeFullWidth,
    extractDate,
    stripHtmlTags,
    detectMeetingType: vi.fn(() => "unknown"),
    fetchWithEncoding: vi.fn(),
    fetchWithEncodingPost: vi.fn(),
    fetchRawBytes: vi.fn(),
    fetchRawBytesPost: vi.fn(),
    decodeShiftJis: vi.fn(),
    percentEncodeBytes: vi.fn(),
    extractTreedepthRawBytes: vi.fn(() => []),
  };
});

import { fetchFromIndexHtml, fetchFromCgi } from "./list";
import { fetchWithEncoding, fetchRawBytes } from "./shared";

describe("fetchFromIndexHtml", () => {
  const mockFetchWithEncoding = (fetchWithEncoding as ReturnType<typeof vi.fn>);
  const mockFetchRawBytes = (fetchRawBytes as ReturnType<typeof vi.fn>);

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("日付つき See.exe リンクがある場合はそのまま返す", async () => {
    mockFetchWithEncoding.mockResolvedValue(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=abc">令和7年3月1日 本会議</a>
      </body></html>`
    );

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    expect(result).toEqual([
      {
        title: "令和7年3月1日 本会議",
        heldOn: "2025-03-01",
        url: "http://www.kensakusystem.jp/testcity/cgi-bin3/See.exe?Code=abc",
      },
    ]);
    // fetchWithEncoding は1回だけ呼ばれる（フォールバックしない）
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
  });

  test("日付なし See.exe リンクのみの場合は fetchFromSapphire にフォールバック", async () => {
    // 1回目: fetchFromIndexHtml が index.html を取得（日付なしリンクのみ）
    mockFetchWithEncoding.mockResolvedValueOnce(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=abc">会議録の閲覧</a>
      </body></html>`
    );
    // fetchFromSapphire は fetchRawBytes を使う
    mockFetchRawBytes.mockResolvedValue(null);

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    // fetchFromIndexHtml が fetchWithEncoding を1回呼び、
    // fetchFromSapphire へのフォールバックで fetchRawBytes が呼ばれることを確認
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
    expect(mockFetchRawBytes).toHaveBeenCalled();
  });

  test("HTML 取得に失敗した場合は null を返す", async () => {
    mockFetchWithEncoding.mockResolvedValue(null);

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    expect(result).toBeNull();
  });
});

describe("fetchFromCgi", () => {
  const mockFetchWithEncoding = (fetchWithEncoding as ReturnType<typeof vi.fn>);
  const mockFetchRawBytes = (fetchRawBytes as ReturnType<typeof vi.fn>);

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("日付つき See.exe リンクがある場合はそのまま返す", async () => {
    mockFetchWithEncoding.mockResolvedValue(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=xyz">令和6年12月15日 予算委員会</a>
      </body></html>`
    );

    const result = await fetchFromCgi(
      "http://www.kensakusystem.jp/testcity/cgi/Search2.exe"
    );

    expect(result).toEqual([
      {
        title: "令和6年12月15日 予算委員会",
        heldOn: "2024-12-15",
        url: "http://www.kensakusystem.jp/testcity/cgi/cgi-bin3/See.exe?Code=xyz",
      },
    ]);
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
  });

  test("日付なしリンクのみの場合は fetchFromSapphire にフォールバック", async () => {
    // 1回目: fetchFromCgi が Search2.exe を取得（日付なし）
    mockFetchWithEncoding.mockResolvedValueOnce(
      `<html><body><p>検索フォーム</p></body></html>`
    );
    // fetchFromSapphire は fetchRawBytes を使う
    mockFetchRawBytes.mockResolvedValue(null);

    const result = await fetchFromCgi(
      "http://www.kensakusystem.jp/testcity/cgi/Search2.exe"
    );

    // fetchFromCgi が fetchWithEncoding を1回呼び、
    // fetchFromSapphire へのフォールバックで fetchRawBytes が呼ばれることを確認
    expect(mockFetchWithEncoding).toHaveBeenCalledTimes(1);
    expect(mockFetchRawBytes).toHaveBeenCalled();
  });
});
