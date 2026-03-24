import { describe, expect, it } from "vitest";
import {
  parseFramesetFilename,
  eraCodeToWesternYear,
  buildIndexUrl,
  parseIndexPage,
  parseListPage,
  parsePdfLinksFromListPage,
  parseDateFromPdfLinkText,
} from "./list";

describe("parseFramesetFilename", () => {
  it("令和6年12月定例会のファイル名をパースする", () => {
    const result = parseFramesetFilename("R0612T");
    expect(result).toEqual({ eraCode: "R06", month: 12, sessionType: "T" });
  });

  it("令和6年11月臨時会のファイル名をパースする", () => {
    const result = parseFramesetFilename("R0611R");
    expect(result).toEqual({ eraCode: "R06", month: 11, sessionType: "R" });
  });

  it("平成31年3月定例会のファイル名をパースする", () => {
    const result = parseFramesetFilename("H3103T");
    expect(result).toEqual({ eraCode: "H31", month: 3, sessionType: "T" });
  });

  it("小文字の平成29年12月定例会のファイル名をパースする", () => {
    const result = parseFramesetFilename("H2912T");
    expect(result).toEqual({ eraCode: "H29", month: 12, sessionType: "T" });
  });

  it("旧命名規則（h2106t4-1-n）は null を返す", () => {
    const result = parseFramesetFilename("h2106t4-1-n");
    expect(result).toBeNull();
  });

  it("目次ファイル（R0612TM）は null を返す", () => {
    const result = parseFramesetFilename("R0612TM");
    expect(result).toBeNull();
  });
});

describe("eraCodeToWesternYear", () => {
  it("R06 -> 2024", () => {
    expect(eraCodeToWesternYear("R06")).toBe(2024);
  });

  it("R01 -> 2019", () => {
    expect(eraCodeToWesternYear("R01")).toBe(2019);
  });

  it("H31 -> 2019", () => {
    expect(eraCodeToWesternYear("H31")).toBe(2019);
  });

  it("H29 -> 2017", () => {
    expect(eraCodeToWesternYear("H29")).toBe(2017);
  });

  it("R02 -> 2020", () => {
    expect(eraCodeToWesternYear("R02")).toBe(2020);
  });

  it("不正な形式は null を返す", () => {
    expect(eraCodeToWesternYear("X99")).toBeNull();
  });
});

describe("buildIndexUrl", () => {
  it("フレームセット URL から目次 URL を組み立てる", () => {
    expect(
      buildIndexUrl(
        "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T.html",
      ),
    ).toBe(
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612TM.html",
    );
  });
});

describe("parseIndexPage", () => {
  it("目次ページから号数と開催日を抽出する", () => {
    const html = `
      <html><body>
      議会定例会会議録<br>
      <a href="R0612T_01.html" target="main">１号（１２月１０日）</a><br>
      <a href="R0612T_02.html" target="main">２号（１２月１１日）</a><br>
      <a href="R0612T_01.html#議事日程" target="main">議事日程</a><br>
      </body></html>
    `;
    const baseUrl =
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612TM.html";

    const results = parseIndexPage(html, baseUrl, 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.contentUrl).toBe(
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T_01.html",
    );
    expect(results[0]!.heldOn).toBe("2024-12-10");
    expect(results[0]!.sessionNum).toBe(1);
    expect(results[1]!.contentUrl).toBe(
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T_02.html",
    );
    expect(results[1]!.heldOn).toBe("2024-12-11");
    expect(results[1]!.sessionNum).toBe(2);
  });

  it("重複する URL は除外する", () => {
    const html = `
      <a href="R0612T_01.html" target="main">１号（１２月１０日）</a>
      <a href="R0612T_01.html#議事日程" target="main">議事日程</a>
    `;
    const baseUrl =
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612TM.html";

    const results = parseIndexPage(html, baseUrl, 2024);
    expect(results).toHaveLength(1);
  });

  it("号数リンクがない場合は空配列を返す", () => {
    const html = `<html><body>会議録なし</body></html>`;
    const results = parseIndexPage(html, "https://example.com/", 2024);
    expect(results).toHaveLength(0);
  });
});

describe("parseListPage", () => {
  it("指定年のフレームセット URL を抽出する", () => {
    const html = `
      <html><body>
      <h3>令和6年</h3>
      <a href="http://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T.html">12月定例会（第7回）</a>
      <a href="http://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0611R.html">11月臨時会（第6回）</a>
      <h3>令和5年</h3>
      <a href="http://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R05/R0512T.html">12月定例会（第7回）</a>
      </body></html>
    `;

    const results = parseListPage(html, 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.framesetUrl).toBe(
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T.html",
    );
    expect(results[0]!.meetingType).toBe("plenary");
    expect(results[1]!.framesetUrl).toBe(
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0611R.html",
    );
    expect(results[1]!.meetingType).toBe("extraordinary");
  });

  it("旧ドメインの URL も新ドメインに正規化する", () => {
    const html = `
      <a href="http://shinhidaka.hokkai.jp/gikai/kaigiroku/H31-R01/R0112T.html">12月定例会</a>
    `;

    // R01 -> 2019
    const results = parseListPage(html, 2019);

    expect(results).toHaveLength(1);
    expect(results[0]!.framesetUrl).toBe(
      "https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/H31-R01/R0112T.html",
    );
  });

  it("目次ファイル（M.html）はスキップする", () => {
    const html = `
      <a href="http://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612TM.html">目次</a>
    `;
    const results = parseListPage(html, 2024);
    expect(results).toHaveLength(0);
  });

  it("対象年以外のリンクはスキップする", () => {
    const html = `
      <a href="http://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T.html">12月定例会</a>
      <a href="http://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R05/R0512T.html">12月定例会</a>
    `;
    const results = parseListPage(html, 2024);
    expect(results).toHaveLength(1);
    expect(results[0]!.year).toBe(2024);
  });
});

describe("parseDateFromPdfLinkText", () => {
  it("1日目のリンクテキストから日付を抽出する", () => {
    const result = parseDateFromPdfLinkText(
      "【未定稿】12月定例会（第7回）1日目◆9日（火曜日）",
      2025,
    );
    expect(result).toBe("2025-12-09");
  });

  it("臨時会のリンクテキストから日付を抽出する", () => {
    const result = parseDateFromPdfLinkText(
      "【未定稿】11月臨時会（第6回）5日（水曜日）",
      2025,
    );
    expect(result).toBe("2025-11-05");
  });

  it("◆マーカーがない場合は null を返す", () => {
    const result = parseDateFromPdfLinkText("12月定例会（第7回）", 2025);
    expect(result).toBeNull();
  });
});

describe("parsePdfLinksFromListPage", () => {
  it("指定年の PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <h2>令和7年</h2>
      <p>令和7年第7回定例会</p>
      <a href="/hotnews/files/00000100/00000185/20260312171630.pdf">【未定稿】12月定例会（第7回）1日目◆9日（火曜日）</a>
      <a href="/hotnews/files/00000100/00000185/20260312171647.pdf">【未定稿】12月定例会（第7回）2日目◆10日（水曜日）</a>
      <h2>令和6年</h2>
      <p>令和6年の会議録はHTML形式で提供</p>
      </body></html>
    `;

    const results = parsePdfLinksFromListPage(html, 2025);

    expect(results).toHaveLength(2);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.shinhidaka-hokkaido.jp/hotnews/files/00000100/00000185/20260312171630.pdf",
    );
    expect(results[0]!.heldOn).toBe("2025-12-09");
    expect(results[0]!.meetingType).toBe("plenary");
    expect(results[1]!.heldOn).toBe("2025-12-10");
  });

  it("臨時会を正しく分類する", () => {
    const html = `
      <p>令和7年</p>
      <a href="/hotnews/files/00000100/00000185/20260312171731.pdf">【未定稿】11月臨時会（第6回）5日（水曜日）</a>
    `;

    const results = parsePdfLinksFromListPage(html, 2025);

    expect(results).toHaveLength(1);
    expect(results[0]!.meetingType).toBe("extraordinary");
  });
});
