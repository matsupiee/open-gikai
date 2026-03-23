import { describe, expect, it } from "vitest";
import { extractPdfLinks } from "./list";
import { parseWarekiYear, detectMeetingType, isSkipTarget } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第1回定例会")).toBe(2024);
    expect(parseWarekiYear("令和7年第1回臨時会")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第4回定例会")).toBe(2018);
    expect(parseWarekiYear("平成17年第1回定例会")).toBe(2005);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("3月定例会")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("3月定例会（開会・提案説明・質疑・委員会付託）")).toBe("plenary");
    expect(detectMeetingType("令和6年第1回定例会")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("令和6年第1回臨時会")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務常任委員会")).toBe("committee");
  });
});

describe("isSkipTarget", () => {
  it("会期日程はスキップ対象", () => {
    expect(isSkipTarget("会期日程")).toBe(true);
  });

  it("議事日程はスキップ対象", () => {
    expect(isSkipTarget("議事日程")).toBe(true);
  });

  it("応招はスキップ対象", () => {
    expect(isSkipTarget("応招・不応招")).toBe(true);
  });

  it("不応招はスキップ対象", () => {
    expect(isSkipTarget("不応招")).toBe(true);
  });

  it("会議録本文はスキップ対象外", () => {
    expect(isSkipTarget("3月定例会（開会・提案説明・質疑・委員会付託）")).toBe(false);
    expect(isSkipTarget("令和6年第1回臨時会")).toBe(false);
    expect(isSkipTarget("一般質問1日目")).toBe(false);
  });
});

describe("extractPdfLinks", () => {
  it("投稿ページから PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <p><a href="https://www.town.mie-kihoku.lg.jp/assets25/pdf/r6-1rinjikai.pdf">「令和6年第1回臨時会」</a></p>
        <p><a href="https://www.town.mie-kihoku.lg.jp/assets25/pdf/r6-3teireikai-kaikai.pdf">「3月定例会（開会・提案説明・質疑・委員会付託）」</a></p>
        <p><a href="https://www.town.mie-kihoku.lg.jp/assets25/pdf/r6-3teireikai-ippan1.pdf">「一般質問1日目」</a></p>
      </div>
    `;

    const result = extractPdfLinks(
      html,
      2024,
      "https://www.town.mie-kihoku.lg.jp/2024/07/12/570/"
    );

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和6年第1回臨時会");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.pdfUrl).toBe("https://www.town.mie-kihoku.lg.jp/assets25/pdf/r6-1rinjikai.pdf");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.postUrl).toBe("https://www.town.mie-kihoku.lg.jp/2024/07/12/570/");

    expect(result[1]!.title).toBe("3月定例会（開会・提案説明・質疑・委員会付託）");
    expect(result[1]!.meetingType).toBe("plenary");

    expect(result[2]!.title).toBe("一般質問1日目");
    expect(result[2]!.meetingType).toBe("plenary");
  });

  it("参考資料 PDF（会期日程・議事日程・応招）を除外する", () => {
    const html = `
      <a href="/assets25/pdf/kaikijitteikoteihyo.pdf">「会期日程」</a>
      <a href="/assets25/pdf/gijinittei.pdf">「議事日程」</a>
      <a href="/assets25/pdf/ousho.pdf">「応招・不応招」</a>
      <a href="/assets25/pdf/r6-3teireikai-kaikai.pdf">「3月定例会（開会・提案説明）」</a>
    `;

    const result = extractPdfLinks(
      html,
      2024,
      "https://www.town.mie-kihoku.lg.jp/2024/07/12/570/"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("3月定例会（開会・提案説明）");
  });

  it("/wp-content/uploads/ パスの PDF も抽出する", () => {
    const html = `
      <a href="/wp-content/uploads/2024/07/abc123def.pdf">「6月定例会（委員長報告・採決・閉会）」</a>
    `;

    const result = extractPdfLinks(
      html,
      2024,
      "https://www.town.mie-kihoku.lg.jp/2024/07/12/570/"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.mie-kihoku.lg.jp/wp-content/uploads/2024/07/abc123def.pdf"
    );
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<div><p>会議録は準備中です。</p></div>";
    const result = extractPdfLinks(
      html,
      2024,
      "https://www.town.mie-kihoku.lg.jp/2024/07/12/570/"
    );
    expect(result).toEqual([]);
  });

  it("カギカッコのないリンクテキストもタイトルとして取得する", () => {
    const html = `
      <a href="/assets25/pdf/r6-3teireikai.pdf">3月定例会</a>
    `;

    const result = extractPdfLinks(
      html,
      2024,
      "https://www.town.mie-kihoku.lg.jp/2024/07/12/570/"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("3月定例会");
  });
});
