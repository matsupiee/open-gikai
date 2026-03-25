import { describe, it, expect } from "vitest";
import {
  parseListPage,
  parseMeetingDateFromText,
  parseMeetingTitleFromText,
  parseMeetingDayFromText,
  parseYearFromPdfUrl,
} from "./list";

describe("parseListPage", () => {
  it("/storage/files/gikai/ を含む PDF リンクを抽出する", () => {
    const html = `
      <a href="/storage/files/gikai/gijiroku7.3-1.pdf">令和7年3月定例会 第1日</a>
      <a href="/storage/files/gikai/gijiroku7.3-2.pdf">令和7年3月定例会 第2日</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku7.3-1.pdf"
    );
    expect(meetings[0]!.linkText).toBe("令和7年3月定例会 第1日");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku7.3-2.pdf"
    );
  });

  it("絶対 URL の PDF リンクをそのまま返す", () => {
    const html = `
      <a href="https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku7.3-1.pdf">定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku7.3-1.pdf"
    );
  });

  it("臨時会の PDF リンクを抽出する（r サフィックス）", () => {
    const html = `
      <a href="/storage/files/gikai/gijiroku2.5r.pdf">令和2年5月臨時会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("gijiroku2.5r.pdf");
  });

  it("重複する URL を除外する", () => {
    const html = `
      <a href="/storage/files/gikai/gijiroku7.3-1.pdf">定例会 第1日</a>
      <a href="/storage/files/gikai/gijiroku7.3-1.pdf">定例会 第1日（再掲）</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
  });

  it("議事録以外の PDF リンクを除外する（storage/files/gikai 以外）", () => {
    const html = `
      <a href="/storage/files/other/document.pdf">その他資料</a>
      <a href="/storage/files/gikai/gijiroku7.3-1.pdf">定例会</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("gijiroku7.3-1.pdf");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません。</p></div>`;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(0);
  });

  it("リンクテキストの HTML タグを除去する", () => {
    const html = `
      <a href="/storage/files/gikai/gijiroku7.3-1.pdf"><span>令和7年3月定例会</span></a>
    `;

    const meetings = parseListPage(html);

    expect(meetings[0]!.linkText).toBe("令和7年3月定例会");
  });

  it("括弧付きファイル名も抽出する", () => {
    const html = `
      <a href="/storage/files/gikai/gijiroku6.6-1(1).pdf">令和6年6月定例会 第1日(1)</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("gijiroku6.6-1(1).pdf");
  });
});

describe("parseMeetingDateFromText", () => {
  it("令和年月日を YYYY-MM-DD にパースする（全角数字）", () => {
    const text = `令和７年３月１２日　越知町議会（定例会）を越知町役場議場に招集された。`;

    expect(parseMeetingDateFromText(text)).toBe("2025-03-12");
  });

  it("令和年月日を YYYY-MM-DD にパースする（半角数字）", () => {
    const text = `令和7年3月12日　越知町議会（定例会）を越知町役場議場に招集された。`;

    expect(parseMeetingDateFromText(text)).toBe("2025-03-12");
  });

  it("平成年月日を YYYY-MM-DD にパースする", () => {
    const text = `平成29年3月10日　越知町議会（定例会）を招集された。`;

    expect(parseMeetingDateFromText(text)).toBe("2017-03-10");
  });

  it("令和元年をパースする", () => {
    const text = `令和元年6月10日　越知町議会（定例会）を越知町役場議場に招集された。`;

    expect(parseMeetingDateFromText(text)).toBe("2019-06-10");
  });

  it("日付が見つからない場合は null を返す", () => {
    expect(parseMeetingDateFromText("会議録テキスト")).toBeNull();
  });
});

describe("parseMeetingTitleFromText", () => {
  it("定例会のタイトルを抽出する（全角数字）", () => {
    const text = `令和７年第２回越知町議会定例会　会議録`;

    expect(parseMeetingTitleFromText(text)).toBe("第2回 定例会");
  });

  it("臨時会のタイトルを抽出する", () => {
    const text = `令和２年第１回越知町議会臨時会　会議録`;

    expect(parseMeetingTitleFromText(text)).toBe("第1回 臨時会");
  });

  it("タイトルが見つからない場合は null を返す", () => {
    expect(parseMeetingTitleFromText("会議録テキスト")).toBeNull();
  });
});

describe("parseMeetingDayFromText", () => {
  it("開議第N日を抽出する（全角数字）", () => {
    const text = `１．開 議 日　令和７年３月１２日（水）　開議第３日`;

    expect(parseMeetingDayFromText(text)).toBe(3);
  });

  it("開議第N日を抽出する（半角数字）", () => {
    const text = `開議第1日`;

    expect(parseMeetingDayFromText(text)).toBe(1);
  });

  it("開議日数が見つからない場合は null を返す", () => {
    expect(parseMeetingDayFromText("会議録テキスト")).toBeNull();
  });
});

describe("parseYearFromPdfUrl", () => {
  it("令和7年（gijiroku7）を 2025 年に変換する", () => {
    expect(parseYearFromPdfUrl("https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku7.3-1.pdf")).toBe(2025);
  });

  it("令和2年（gijiroku2）を 2020 年に変換する", () => {
    expect(parseYearFromPdfUrl("https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku2.5r.pdf")).toBe(2020);
  });

  it("平成29年（gijiroku29）を 2017 年に変換する", () => {
    expect(parseYearFromPdfUrl("https://www.town.ochi.kochi.jp/storage/files/gikai/gijiroku29.3-R.pdf")).toBe(2017);
  });

  it("誤字のある gojiroku でも解析できる", () => {
    expect(parseYearFromPdfUrl("https://www.town.ochi.kochi.jp/storage/files/gikai/gojiroku4.1r.pdf")).toBe(2022);
  });

  it("パターンに一致しない場合は null を返す", () => {
    expect(parseYearFromPdfUrl("https://example.com/document.pdf")).toBeNull();
  });
});
