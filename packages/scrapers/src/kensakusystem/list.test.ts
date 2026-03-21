import { describe, expect, test, vi, afterEach } from "vitest";
import {
  parseDateFromFilename,
  extractSlugFromUrl,
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
  fetchFromIndexHtml,
  fetchFromCgi,
} from "./list";
import * as shared from "./shared";
import * as list from "./list";

describe("parseDateFromFilename", () => {
  test("令和の日付を解析 (R080106)", () => {
    expect(parseDateFromFilename("R080106B02")).toBe("2026-01-06");
  });

  test("平成の日付を解析 (H310401)", () => {
    expect(parseDateFromFilename("H310401")).toBe("2019-04-01");
  });

  test("昭和の日付を解析 (S600315)", () => {
    expect(parseDateFromFilename("S600315")).toBe("1985-03-15");
  });

  test("小文字のエラ文字にも対応", () => {
    expect(parseDateFromFilename("r060101")).toBe("2024-01-01");
  });

  test("月が00の場合は01にフォールバック", () => {
    expect(parseDateFromFilename("R080001")).toBe("2026-01-01");
  });

  test("日が00の場合は01にフォールバック", () => {
    expect(parseDateFromFilename("R080100")).toBe("2026-01-01");
  });

  test("不正な形式は null", () => {
    expect(parseDateFromFilename("invalid")).toBeNull();
  });

  test("未知のエラ文字は null", () => {
    expect(parseDateFromFilename("X080101")).toBeNull();
  });
});

describe("extractSlugFromUrl", () => {
  test("kensakusystem.jp のスラッグを抽出", () => {
    expect(
      extractSlugFromUrl(
        "https://www.kensakusystem.jp/cityname/sapphire.html"
      )
    ).toBe("cityname");
  });

  test("マッチしない場合は null", () => {
    expect(extractSlugFromUrl("https://example.com/page")).toBeNull();
  });
});

describe("URL タイプ判定", () => {
  test("isSapphireType", () => {
    expect(
      isSapphireType(
        "https://www.kensakusystem.jp/city/sapphire.html"
      )
    ).toBe(true);
    expect(
      isSapphireType("https://www.kensakusystem.jp/city/index.html")
    ).toBe(false);
  });

  test("isCgiType", () => {
    expect(
      isCgiType("https://www.kensakusystem.jp/city/cgi/Search2.exe")
    ).toBe(true);
    expect(
      isCgiType("https://www.kensakusystem.jp/city/sapphire.html")
    ).toBe(false);
  });

  test("isIndexHtmlType", () => {
    expect(
      isIndexHtmlType("https://www.kensakusystem.jp/city/index.html")
    ).toBe(true);
    expect(
      isIndexHtmlType(
        "https://www.kensakusystem.jp/city/sapphire.html"
      )
    ).toBe(false);
  });
});

describe("fetchFromIndexHtml", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("日付つき See.exe リンクがある場合はそのまま返す", async () => {
    vi.spyOn(shared, "fetchWithEncoding").mockResolvedValue(
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
  });

  test("日付なし See.exe リンクのみの場合は fetchFromSapphire にフォールバック", async () => {
    vi.spyOn(shared, "fetchWithEncoding").mockResolvedValue(
      `<html><body>
        <a href="cgi-bin3/See.exe?Code=abc">会議録の閲覧</a>
      </body></html>`
    );
    const sapphireResult = [
      { title: "総務委員会 2025-02-10", heldOn: "2025-02-10", url: "http://example.com/result" },
    ];
    vi.spyOn(list, "fetchFromSapphire").mockResolvedValue(sapphireResult);

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    expect(list.fetchFromSapphire).toHaveBeenCalledWith(
      "http://www.kensakusystem.jp/testcity/index.html"
    );
    expect(result).toEqual(sapphireResult);
  });

  test("HTML 取得に失敗した場合は null を返す", async () => {
    vi.spyOn(shared, "fetchWithEncoding").mockResolvedValue(null);

    const result = await fetchFromIndexHtml(
      "http://www.kensakusystem.jp/testcity/index.html"
    );

    expect(result).toBeNull();
  });
});

describe("fetchFromCgi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("日付つき See.exe リンクがある場合はそのまま返す", async () => {
    vi.spyOn(shared, "fetchWithEncoding").mockResolvedValue(
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
  });

  test("日付なしリンクのみの場合は fetchFromSapphire にフォールバック", async () => {
    vi.spyOn(shared, "fetchWithEncoding").mockResolvedValue(
      `<html><body><p>検索フォーム</p></body></html>`
    );
    const sapphireResult = [
      { title: "本会議 2025-01-20", heldOn: "2025-01-20", url: "http://example.com/result2" },
    ];
    vi.spyOn(list, "fetchFromSapphire").mockResolvedValue(sapphireResult);

    const result = await fetchFromCgi(
      "http://www.kensakusystem.jp/testcity/cgi/Search2.exe"
    );

    expect(list.fetchFromSapphire).toHaveBeenCalledWith(
      "http://www.kensakusystem.jp/testcity/cgi/Search2.exe"
    );
    expect(result).toEqual(sapphireResult);
  });
});
