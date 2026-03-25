import { describe, it, expect } from "vitest";
import { parseYearPage, parseLinkText } from "./list";

describe("parseLinkText", () => {
  it("令和年・臨時会・開催月あり のリンクテキストをパースする", () => {
    const result = parseLinkText("令和6年第1回臨時会会議録(令和6年1月開催)");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.meetingSession).toBe(1);
    expect(result!.meetingKind).toBe("臨時会");
    expect(result!.month).toBe(1);
  });

  it("令和年・定例会・開催月なし のリンクテキストをパースする", () => {
    const result = parseLinkText("令和7年第2回定例会会議録");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.meetingSession).toBe(2);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.month).toBeNull();
  });

  it("平成年・定例会 のリンクテキストをパースする", () => {
    const result = parseLinkText("平成17年第3回定例会");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2005);
    expect(result!.meetingSession).toBe(3);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("令和元年 をパースする", () => {
    const result = parseLinkText("令和元年第1回定例会会議録");

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
  });

  it("会議録でないテキストは null を返す", () => {
    const result = parseLinkText("宿毛市議会のページ");

    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("PDF リンクと会議メタ情報を抽出する", () => {
    const html = `
      <a href="/fs/7/0/0/5/0/_/_____6__1____.pdf">令和6年第1回臨時会会議録(令和6年1月開催)</a>
      <a href="/fs/7/1/2/3/4/_/r0603.pdf">令和6年第1回定例会会議録(令和6年3月開催)</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.sukumo.kochi.jp/fs/7/0/0/5/0/_/_____6__1____.pdf"
    );
    expect(meetings[0]!.section).toBe("第1回 臨時会");
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.month).toBe(1);
    expect(meetings[0]!.meetingKind).toBe("臨時会");
    expect(meetings[1]!.section).toBe("第1回 定例会");
    expect(meetings[1]!.meetingKind).toBe("定例会");
  });

  it("定例会と臨時会を区別する", () => {
    const html = `
      <a href="/fs/1/r0303.pdf">令和3年第1回定例会会議録</a>
      <a href="/fs/2/r03tmp.pdf">令和3年第1回臨時会会議録</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.meetingKind).toBe("定例会");
    expect(meetings[1]!.meetingKind).toBe("臨時会");
  });

  it("平成年の PDF リンクを抽出する", () => {
    const html = `
      <a href="/fs/old/h1706.pdf">平成17年第3回定例会</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2005);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.sukumo.kochi.jp/fs/old/h1706.pdf"
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません。</p></div>`;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(0);
  });

  it("PDF リンクがあっても会議録でないリンクは除外する", () => {
    const html = `
      <a href="/fs/doc.pdf">添付資料のダウンロード</a>
      <a href="/fs/r0601.pdf">令和6年第1回定例会会議録</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingKind).toBe("定例会");
  });

  it("既に https:// で始まる PDF URL をそのまま使用する", () => {
    const html = `
      <a href="https://www.city.sukumo.kochi.jp/fs/external.pdf">令和6年第1回定例会会議録</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.sukumo.kochi.jp/fs/external.pdf"
    );
  });
});
