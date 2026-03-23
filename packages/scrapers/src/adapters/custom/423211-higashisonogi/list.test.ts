import { describe, expect, it } from "vitest";
import {
  convertHeadingToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { parseListPage, parseLinkText, resolveUrl } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和７年")).toBe("令和7年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertHeadingToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertHeadingToWesternYear("令和7年議会会議録")).toBe(2025);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和７年議会会議録")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年議会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成30年議会会議録")).toBe(2018);
    expect(convertHeadingToWesternYear("平成27年議会会議録")).toBe(2015);
  });

  it("平成元年を変換する", () => {
    expect(convertHeadingToWesternYear("平成元年議会会議録")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第4回定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });
});

describe("parseLinkText", () => {
  it("定例会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第4回定例会（令和7年12月11日開催） (PDFファイル: 493.7KB)",
    );
    expect(result).toEqual({
      sessionTitle: "第4回定例会",
      heldOn: "2025-12-11",
    });
  });

  it("臨時会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第1回臨時会（令和6年1月25日開催） (PDFファイル: 100.5KB)",
    );
    expect(result).toEqual({
      sessionTitle: "第1回臨時会",
      heldOn: "2024-01-25",
    });
  });

  it("全角数字のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第４回定例会（令和７年１２月１１日開催） (PDFファイル: 493.7KB)",
    );
    expect(result).toEqual({
      sessionTitle: "第4回定例会",
      heldOn: "2025-12-11",
    });
  });

  it("平成のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第1回定例会（平成27年3月5日開催） (PDFファイル: 200KB)",
    );
    expect(result).toEqual({
      sessionTitle: "第1回定例会",
      heldOn: "2015-03-05",
    });
  });

  it("令和元年のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第1回臨時会（令和元年5月10日開催） (PDFファイル: 50KB)",
    );
    expect(result).toEqual({
      sessionTitle: "第1回臨時会",
      heldOn: "2019-05-10",
    });
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseLinkText("議事日程（PDFファイル: 10KB）")).toBeNull();
  });
});

describe("resolveUrl", () => {
  it("プロトコル相対URLを絶対URLに変換する", () => {
    expect(
      resolveUrl(
        "//www.town.higashisonogi.lg.jp/material/files/group/44/test.pdf",
      ),
    ).toBe(
      "https://www.town.higashisonogi.lg.jp/material/files/group/44/test.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.town.higashisonogi.lg.jp/material/files/group/44/test.pdf",
      ),
    ).toBe(
      "https://www.town.higashisonogi.lg.jp/material/files/group/44/test.pdf",
    );
  });
});

describe("parseListPage", () => {
  it("h2見出しとPDFリンクを抽出する", () => {
    const html = `
      <h2>令和7年議会会議録</h2>
      <h3>定例会</h3>
      <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/reiwa7teireikai12gatu11niti.pdf">
        第4回定例会（令和7年12月11日開催） (PDFファイル: 493.7KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "第4回定例会",
      pdfUrl:
        "https://www.town.higashisonogi.lg.jp/material/files/group/44/reiwa7teireikai12gatu11niti.pdf",
      meetingType: "plenary",
      headingYear: 2025,
      heldOn: "2025-12-11",
    });
  });

  it("複数年度・複数リンクを正しく紐付ける", () => {
    const html = `
      <h2>令和7年議会会議録</h2>
      <h3>定例会</h3>
      <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/a.pdf">
        第4回定例会（令和7年12月11日開催） (PDFファイル: 493.7KB)
      </a>
      <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/b.pdf">
        第3回定例会（令和7年9月5日開催） (PDFファイル: 300KB)
      </a>
      <h3>臨時会</h3>
      <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/c.pdf">
        第1回臨時会（令和7年1月29日開催） (PDFファイル: 100KB)
      </a>
      <h2>令和6年議会会議録</h2>
      <h3>定例会</h3>
      <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/d.pdf">
        第4回定例会（令和6年12月12日開催） (PDFファイル: 500KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(4);
    expect(result[0]!.headingYear).toBe(2025);
    expect(result[0]!.title).toBe("第4回定例会");
    expect(result[0]!.heldOn).toBe("2025-12-11");
    expect(result[1]!.headingYear).toBe(2025);
    expect(result[1]!.title).toBe("第3回定例会");
    expect(result[2]!.headingYear).toBe(2025);
    expect(result[2]!.title).toBe("第1回臨時会");
    expect(result[2]!.meetingType).toBe("extraordinary");
    expect(result[3]!.headingYear).toBe(2024);
    expect(result[3]!.heldOn).toBe("2024-12-12");
  });

  it("PDF以外のリンクを除外する", () => {
    const html = `
      <h2>令和7年議会会議録</h2>
      <h3>定例会</h3>
      <a href="//example.com/test.docx">
        第1回定例会（令和7年3月5日開催） (Wordファイル)
      </a>
      <a href="//example.com/test.pdf">
        第2回定例会（令和7年6月10日開催） (PDFファイル: 200KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第2回定例会");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("平成の年度見出しを正しく処理する", () => {
    const html = `
      <h2>平成27年議会会議録</h2>
      <h3>定例会</h3>
      <a href="//example.com/test.pdf">
        第1回定例会（平成27年3月5日開催） (PDFファイル: 200KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2015);
    expect(result[0]!.heldOn).toBe("2015-03-05");
  });
});
