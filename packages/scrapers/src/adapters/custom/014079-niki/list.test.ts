import { describe, expect, it } from "vitest";
import { parseLinkText, parseListPage } from "./list";
import {
  toHalfWidth,
  convertWarekiDateToISO,
  detectMeetingType,
} from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和２年３月９日")).toBe("令和2年3月9日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });

  it("全角半角が混在する文字列を処理する", () => {
    expect(toHalfWidth("第１回定例会2日目")).toBe("第1回定例会2日目");
  });
});

describe("convertWarekiDateToISO", () => {
  it("令和の日付を変換する", () => {
    expect(convertWarekiDateToISO("令和7年12月18日")).toBe("2025-12-18");
  });

  it("令和6年の日付を変換する", () => {
    expect(convertWarekiDateToISO("令和6年9月24日")).toBe("2024-09-24");
  });

  it("令和元年に対応する", () => {
    expect(convertWarekiDateToISO("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(convertWarekiDateToISO("平成23年4月27日")).toBe("2011-04-27");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiDateToISO("2024年3月1日")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });

  it("デフォルトはplenaryを返す", () => {
    expect(detectMeetingType("本会議")).toBe("plenary");
  });
});

describe("parseLinkText", () => {
  it("基本的な定例会をパースする", () => {
    const result = parseLinkText(
      "第4回定例会（令和7年12月18日開催） (PDF:1.47MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第4回定例会");
    expect(result!.heldOn).toBe("2025-12-18");
    expect(result!.meetingType).toBe("plenary");
  });

  it("複数日程の定例会をパースする（N日目）", () => {
    const result = parseLinkText(
      "第1回定例会3日目（令和7年3月17日開催） (PDF:828KB)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会3日目");
    expect(result!.heldOn).toBe("2025-03-17");
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時会をパースする", () => {
    const result = parseLinkText(
      "第1回臨時会（令和6年8月5日開催） (PDF:500KB)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回臨時会");
    expect(result!.heldOn).toBe("2024-08-05");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("特殊表記の臨時会（初議会）をパースする", () => {
    const result = parseLinkText(
      "第1回臨時会〔初議会〕（令和5年5月1日開催）"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回臨時会");
    expect(result!.heldOn).toBe("2023-05-01");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("平成年の定例会をパースする", () => {
    const result = parseLinkText(
      "第1回定例会（平成23年4月27日開催）"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会");
    expect(result!.heldOn).toBe("2011-04-27");
    expect(result!.meetingType).toBe("plenary");
  });

  it("令和元年をパースする", () => {
    const result = parseLinkText(
      "第2回定例会（令和元年6月17日開催）"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第2回定例会");
    expect(result!.heldOn).toBe("2019-06-17");
    expect(result!.meetingType).toBe("plenary");
  });

  it("日付情報がないテキストはnullを返す", () => {
    expect(parseLinkText("資料ファイル")).toBeNull();
    expect(parseLinkText("議事日程")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDFリンクから会議情報を抽出する", () => {
    const html = `
      <div>
        <a href="irv97600000004s6-att/20251218.pdf">第4回定例会（令和7年12月18日開催） (PDF:1.47MB)</a>
        <a href="irv97600000004s6-att/R07.08.05.pdf">第1回臨時会（令和7年8月5日開催） (PDF:500KB)</a>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第4回定例会",
      heldOn: "2025-12-18",
      pdfUrl:
        "https://www.town.niki.hokkaido.jp/section/gikai/irv97600000004s6-att/20251218.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "第1回臨時会",
      heldOn: "2025-08-05",
      pdfUrl:
        "https://www.town.niki.hokkaido.jp/section/gikai/irv97600000004s6-att/R07.08.05.pdf",
      meetingType: "extraordinary",
    });
  });

  it("絶対URLのリンクをそのまま使用する", () => {
    const html = `
      <a href="https://www.town.niki.hokkaido.jp/section/gikai/irv97600000004s6-att/20251218.pdf">第4回定例会（令和7年12月18日開催）</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.niki.hokkaido.jp/section/gikai/irv97600000004s6-att/20251218.pdf"
    );
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("会議情報をパースできないPDFリンクは除外する", () => {
    const html = `
      <a href="/file/unknown.pdf">不明なファイル</a>
    `;
    expect(parseListPage(html)).toEqual([]);
  });

  it("複数日程の会議録を含むリストをパースする", () => {
    const html = `
      <a href="irv97600000004s6-att/r0603.pdf">第1回定例会3日目（令和7年3月17日開催）</a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会3日目");
    expect(result[0]!.heldOn).toBe("2025-03-17");
  });
});
