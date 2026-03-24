import { describe, expect, it } from "vitest";
import {
  parseMeetingListUrls,
  parseDetailUrls,
  extractPageId,
  parseDetailPage,
  extractTitle,
  normalizeText,
  parseTitleYearMonth,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成25年")).toBe(2013);
  });

  it("平成31年(令和元年)パターンを変換する", () => {
    expect(parseWarekiYear("平成31年(令和元年)")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("令和7年12月第152回内子町議会定例会会議録")).toBe(
      "plenary"
    );
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和7年10月内子町議会臨時会会議録")).toBe(
      "extraordinary"
    );
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseMeetingListUrls", () => {
  it("会議種別一覧ページのURLを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3404.html">12月定例会</a></li>
        <li><a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3300.html">9月定例会</a></li>
      </ul>
    `;

    const result = parseMeetingListUrls(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3404.html"
    );
    expect(result[1]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3300.html"
    );
  });

  it("相対パス形式のリンクも抽出する", () => {
    const html = `
      <a href="/site/kaigiroku/list613-3417.html">1月臨時会</a>
    `;

    const result = parseMeetingListUrls(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/list613-3417.html"
    );
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3404.html">12月定例会</a>
      <a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3404.html">12月定例会</a>
    `;

    const result = parseMeetingListUrls(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseMeetingListUrls(html)).toEqual([]);
  });
});

describe("parseDetailUrls", () => {
  it("会議録詳細ページのURLを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html">令和7年12月定例会</a></li>
        <li><a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/145603.html">令和7年10月臨時会</a></li>
      </ul>
    `;

    const result = parseDetailUrls(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html"
    );
    expect(result[1]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/145603.html"
    );
  });

  it("相対パス形式のリンクも抽出する", () => {
    const html = `
      <a href="/site/kaigiroku/145604.html">令和7年12月定例会</a>
    `;

    const result = parseDetailUrls(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html"
    );
  });

  it("重複するURLを除外する", () => {
    const html = `
      <a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html">リンク1</a>
      <a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html">リンク2</a>
    `;

    const result = parseDetailUrls(html);
    expect(result).toHaveLength(1);
  });

  it("listで始まるURLは除外する", () => {
    const html = `
      <a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/list591-3404.html">一覧</a>
      <a href="https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html">詳細</a>
    `;

    const result = parseDetailUrls(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html"
    );
  });
});

describe("extractPageId", () => {
  it("URLからページIDを抽出する", () => {
    expect(
      extractPageId(
        "https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html"
      )
    ).toBe("145604");
  });

  it("相対パスからもページIDを抽出する", () => {
    expect(
      extractPageId("/site/kaigiroku/145604.html")
    ).toBe("145604");
  });

  it("パターンに合致しない場合はnullを返す", () => {
    expect(extractPageId("https://example.com/other.html")).toBeNull();
  });
});

describe("normalizeText", () => {
  it("全角数字を半角に変換する", () => {
    expect(normalizeText("令和７年１２月")).toBe("令和7年12月");
    expect(normalizeText("第１５２回")).toBe("第152回");
  });

  it("全角数字がない場合はそのまま返す", () => {
    expect(normalizeText("令和7年12月")).toBe("令和7年12月");
  });
});

describe("parseTitleYearMonth", () => {
  it("令和の年月を抽出する", () => {
    const result = parseTitleYearMonth(
      "令和7年12月第152回内子町議会定例会会議録"
    );
    expect(result.year).toBe(2025);
    expect(result.month).toBe(12);
  });

  it("全角数字の年月を変換して抽出する", () => {
    const result = parseTitleYearMonth(
      "令和７年１２月第１５２回内子町議会定例会会議録"
    );
    expect(result.year).toBe(2025);
    expect(result.month).toBe(12);
  });

  it("平成の年月を抽出する", () => {
    const result = parseTitleYearMonth(
      "平成25年3月第123回内子町議会定例会会議録"
    );
    expect(result.year).toBe(2013);
    expect(result.month).toBe(3);
  });

  it("臨時会の年月を抽出する", () => {
    const result = parseTitleYearMonth(
      "令和7年10月内子町議会臨時会会議録"
    );
    expect(result.year).toBe(2025);
    expect(result.month).toBe(10);
  });

  it("年月がない場合はnullを返す", () => {
    const result = parseTitleYearMonth("会議録");
    expect(result.year).toBeNull();
    expect(result.month).toBeNull();
  });
});

describe("extractTitle", () => {
  it("h1タグからタイトルを抽出する", () => {
    const html = `
      <h1 class="title">令和７年１２月第１５２回内子町議会定例会会議録</h1>
    `;
    const result = extractTitle(html);
    expect(result).toBe("令和7年12月第152回内子町議会定例会会議録");
  });

  it("h1がない場合はtitleタグから抽出する", () => {
    const html = `
      <title>令和7年10月内子町議会臨時会会議録 | 内子町</title>
    `;
    const result = extractTitle(html);
    expect(result).toBe("令和7年10月内子町議会臨時会会議録");
  });

  it("h1とtitleの両方がない場合は空文字を返す", () => {
    const html = "<p>コンテンツのみ</p>";
    expect(extractTitle(html)).toBe("");
  });
});

describe("parseDetailPage", () => {
  it("詳細ページからPDF情報を抽出する", () => {
    const html = `
      <h1>令和7年12月第152回内子町議会定例会会議録</h1>
      <a href="/uploaded/life/145604_327831_misc.pdf">会議録PDF</a>
    `;

    const result = parseDetailPage(html, "145604");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年12月第152回内子町議会定例会会議録");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.uchiko.ehime.jp/uploaded/life/145604_327831_misc.pdf"
    );
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.month).toBe(12);
    expect(result[0]!.heldOn).toBe("2025-12-01");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pageId).toBe("145604");
  });

  it("臨時会のmeetingTypeがextraordinaryになる", () => {
    const html = `
      <h1>令和7年10月内子町議会臨時会会議録</h1>
      <a href="/uploaded/life/145603_327830_misc.pdf">会議録PDF</a>
    `;

    const result = parseDetailPage(html, "145603");

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = `
      <h1>令和7年12月第152回内子町議会定例会会議録</h1>
      <p>準備中</p>
    `;

    const result = parseDetailPage(html, "145604");
    expect(result).toEqual([]);
  });

  it("重複するPDF URLを除外する", () => {
    const html = `
      <h1>令和7年12月第152回内子町議会定例会会議録</h1>
      <a href="/uploaded/life/145604_327831_misc.pdf">会議録PDF</a>
      <a href="/uploaded/life/145604_327831_misc.pdf">会議録PDF（再掲）</a>
    `;

    const result = parseDetailPage(html, "145604");
    expect(result).toHaveLength(1);
  });

  it("全角数字のタイトルを正規化する", () => {
    const html = `
      <h1>令和７年１２月第１５２回内子町議会定例会会議録</h1>
      <a href="/uploaded/life/145604_327831_misc.pdf">会議録PDF</a>
    `;

    const result = parseDetailPage(html, "145604");

    expect(result[0]!.title).toBe("令和7年12月第152回内子町議会定例会会議録");
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.month).toBe(12);
  });
});
