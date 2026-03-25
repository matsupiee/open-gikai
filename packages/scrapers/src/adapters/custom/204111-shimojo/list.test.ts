import { describe, it, expect } from "vitest";
import {
  parsePdfFilenameDate,
  parseIssueNumber,
  parsePublishDate,
  buildHeldOn,
  resolveUrl,
  parseListPage,
  filterByYear,
} from "./list";

describe("parsePdfFilenameDate", () => {
  it("タイムスタンプ型ファイル名をパースする", () => {
    const result = parsePdfFilenameDate("20220714134025.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2022);
    expect(result!.month).toBe(7);
    expect(result!.day).toBe(14);
  });

  it("日付ハイフン区切り型ファイル名をパースする", () => {
    const result = parsePdfFilenameDate("2024-0115-0943.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(1);
    expect(result!.day).toBe(15);
  });

  it("2023年5月のファイル名をパースする", () => {
    const result = parsePdfFilenameDate("2023-0531-1747.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.month).toBe(5);
    expect(result!.day).toBe(31);
  });

  it("パースできない場合は null を返す", () => {
    expect(parsePdfFilenameDate("readme.pdf")).toBeNull();
    expect(parsePdfFilenameDate("abc.pdf")).toBeNull();
  });
});

describe("parseIssueNumber", () => {
  it("第N号形式を解析する", () => {
    expect(parseIssueNumber("第12号")).toBe(12);
  });

  it("N号形式を解析する", () => {
    expect(parseIssueNumber("12号")).toBe(12);
  });

  it("文章中の号数を解析する", () => {
    expect(parseIssueNumber("議会だより第19号を発行しました")).toBe(19);
  });

  it("号数がない場合は null を返す", () => {
    expect(parseIssueNumber("議会だより")).toBeNull();
  });
});

describe("parsePublishDate", () => {
  it("令和の発行日を解析する", () => {
    const result = parsePublishDate("令和6年1月15日発行");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(1);
    expect(result!.day).toBe(15);
  });

  it("令和元年に対応する", () => {
    const result = parsePublishDate("令和元年9月1日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.month).toBe(9);
    expect(result!.day).toBe(1);
  });

  it("平成の発行日を解析する", () => {
    const result = parsePublishDate("平成30年4月20日");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2018);
    expect(result!.month).toBe(4);
    expect(result!.day).toBe(20);
  });

  it("日付がない場合は null を返す", () => {
    expect(parsePublishDate("議会だより")).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("YYYY-MM-DD 形式を生成する", () => {
    expect(buildHeldOn(2024, 1, 15)).toBe("2024-01-15");
    expect(buildHeldOn(2022, 7, 14)).toBe("2022-07-14");
    expect(buildHeldOn(2023, 10, 16)).toBe("2023-10-16");
  });
});

describe("resolveUrl", () => {
  const baseUrl = "https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/";

  it("絶対 URL はそのまま返す", () => {
    expect(resolveUrl("https://example.com/a.pdf", baseUrl)).toBe(
      "https://example.com/a.pdf"
    );
  });

  it("プロトコル相対パスを https に変換する", () => {
    expect(resolveUrl("//www.vill-shimojo.jp/a.pdf", baseUrl)).toBe(
      "https://www.vill-shimojo.jp/a.pdf"
    );
  });

  it("ルート相対パスを絶対 URL に変換する", () => {
    expect(resolveUrl("/gyousei/a.pdf", baseUrl)).toBe(
      "https://www.vill-shimojo.jp/gyousei/a.pdf"
    );
  });

  it("相対パスを baseUrl に結合する", () => {
    expect(resolveUrl("files/2024-0115-0943.pdf", baseUrl)).toBe(
      "https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/files/2024-0115-0943.pdf"
    );
  });
});

describe("parseListPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <div class="list">
        <p>第19号（令和6年1月15日発行）</p>
        <a href="files/2024-0115-0943.pdf">議会だより第19号（PDF）</a>
        <p>第20号（令和6年4月15日発行）</p>
        <a href="files/2024-0415-1040.pdf">議会だより第20号（PDF）</a>
      </div>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toContain("2024-0115-0943.pdf");
    expect(meetings[0]!.heldOn).toBe("2024-01-15");
    expect(meetings[1]!.pdfUrl).toContain("2024-0415-1040.pdf");
    expect(meetings[1]!.heldOn).toBe("2024-04-15");
  });

  it("タイムスタンプ型ファイル名から日付を取得する", () => {
    const html = `
      <div class="list">
        <p>第12号（令和4年7月14日発行）</p>
        <a href="files/20220714134025.pdf">議会だより第12号（PDF）</a>
      </div>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-07-14");
  });

  it("号数をタイトルに含める", () => {
    const html = `
      <div>
        <p>第19号</p>
        <a href="files/2024-0115-0943.pdf">議会だより（PDF）</a>
      </div>
    `;
    const meetings = parseListPage(html);
    expect(meetings[0]!.title).toContain("第19号");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>議会だより</p></div>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("日付もファイル名も解析できないリンクはスキップする", () => {
    const html = `
      <a href="files/readme.pdf">リードミー</a>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});

describe("filterByYear", () => {
  it("指定年のアイテムのみ返す", () => {
    const items = [
      { pdfUrl: "a.pdf", title: "A", heldOn: "2024-01-15", section: "議会だより" },
      { pdfUrl: "b.pdf", title: "B", heldOn: "2023-10-16", section: "議会だより" },
      { pdfUrl: "c.pdf", title: "C", heldOn: "2024-04-15", section: "議会だより" },
    ];

    const result = filterByYear(items, 2024);
    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("A");
    expect(result[1]!.title).toBe("C");
  });
});
