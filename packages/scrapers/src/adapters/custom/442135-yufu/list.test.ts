import { describe, expect, it } from "vitest";
import {
  parseYearHeading,
  parseSessionLabel,
  extractDateFromLinkText,
  parsePdfLinksFromList,
} from "./list";

describe("parseYearHeading", () => {
  it("令和7年（半角）を正しく解析する", () => {
    expect(parseYearHeading("令和7年")).toBe(2025);
  });

  it("令和７年（全角）を正しく解析する", () => {
    expect(parseYearHeading("令和７年")).toBe(2025);
  });

  it("令和6年を正しく解析する", () => {
    expect(parseYearHeading("令和6年")).toBe(2024);
  });

  it("令和元年を正しく解析する", () => {
    expect(parseYearHeading("令和元年")).toBe(2019);
  });

  it("平成31年を正しく解析する", () => {
    expect(parseYearHeading("平成31年")).toBe(2019);
  });

  it("平成17年を正しく解析する", () => {
    expect(parseYearHeading("平成17年")).toBe(2005);
  });

  it("年号がない場合は null を返す", () => {
    expect(parseYearHeading("年度不明")).toBeNull();
  });

  it("空文字の場合は null を返す", () => {
    expect(parseYearHeading("")).toBeNull();
  });
});

describe("parseSessionLabel", () => {
  it("定例会ラベルを解析する", () => {
    const result = parseSessionLabel("◆第1回定例会");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("第1回定例会");
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時会ラベルを解析する", () => {
    const result = parseSessionLabel("◆第1回臨時会");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("第1回臨時会");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("◆がない場合は null を返す", () => {
    expect(parseSessionLabel("第1回定例会")).toBeNull();
  });

  it("空の場合は null を返す", () => {
    expect(parseSessionLabel("◆")).toBeNull();
  });
});

describe("extractDateFromLinkText", () => {
  it("初日（R7.2.25）から日付を抽出する", () => {
    expect(extractDateFromLinkText("初日（R7.2.25）")).toBe("2025-02-25");
  });

  it("２日目（R7.2.28）から日付を抽出する", () => {
    expect(extractDateFromLinkText("２日目（R7.2.28）")).toBe("2025-02-28");
  });

  it("平成の日付（H17.9.5）を正しく変換する", () => {
    expect(extractDateFromLinkText("初日（H17.9.5）")).toBe("2005-09-05");
  });

  it("小文字 r の元号にも対応する", () => {
    expect(extractDateFromLinkText("初日（r3.3.1）")).toBe("2021-03-01");
  });

  it("括弧がない場合は null を返す", () => {
    expect(extractDateFromLinkText("初日")).toBeNull();
  });

  it("元号略称がない場合は null を返す", () => {
    expect(extractDateFromLinkText("初日（7.2.25）")).toBeNull();
  });

  it("月・日が一桁でもゼロパディングする", () => {
    expect(extractDateFromLinkText("初日（R6.9.5）")).toBe("2024-09-05");
  });

  it("全角数字の日付を変換する", () => {
    expect(extractDateFromLinkText("初日（R７.２.２５）")).toBe("2025-02-25");
  });
});

describe("parsePdfLinksFromList", () => {
  it("令和7年の PDF リンクを正しく収集する", () => {
    const html = `
      <div>
        <h3>令和７年</h3>
        <p>◆第1回定例会</p>
        <p><a href="/uploads/files/2025/07/R7-1-2.25.pdf">初日（R7.2.25）</a></p>
        <p><a href="/uploads/files/2025/07/R7-2-2.28.pdf">２日目（R7.2.28）</a></p>
        <p><a href="/uploads/files/2025/07/R7-3-3.3.pdf">３日目（R7.3.3）</a></p>
      </div>
    `;

    const result = parsePdfLinksFromList(html, 2025);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("2025年第1回定例会 初日（R7.2.25）");
    expect(result[0]!.heldOn).toBe("2025-02-25");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.yufu.oita.jp/uploads/files/2025/07/R7-1-2.25.pdf",
    );
    expect(result[1]!.heldOn).toBe("2025-02-28");
    expect(result[2]!.heldOn).toBe("2025-03-03");
  });

  it("臨時会の PDF リンクも収集する", () => {
    const html = `
      <div>
        <h3>令和６年</h3>
        <p>◆第1回臨時会</p>
        <p><a href="/uploads/files/2024/04/R6-rinj-1-4.8.pdf">開閉会（R6.4.8）</a></p>
      </div>
    `;

    const result = parsePdfLinksFromList(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-04-08");
  });

  it("対象年以外はフィルタリングされる", () => {
    const html = `
      <div>
        <h3>令和７年</h3>
        <p>◆第1回定例会</p>
        <p><a href="/uploads/files/2025/07/R7-1-2.25.pdf">初日（R7.2.25）</a></p>
        <h3>令和６年</h3>
        <p>◆第4回定例会</p>
        <p><a href="/uploads/files/2024/12/R6-4-12.2.pdf">初日（R6.12.2）</a></p>
      </div>
    `;

    const result2025 = parsePdfLinksFromList(html, 2025);
    expect(result2025).toHaveLength(1);
    expect(result2025[0]!.heldOn).toBe("2025-02-25");

    const result2024 = parsePdfLinksFromList(html, 2024);
    expect(result2024).toHaveLength(1);
    expect(result2024[0]!.heldOn).toBe("2024-12-02");
  });

  it("旧パス（/wp-content/uploads/）の PDF リンクも処理する", () => {
    const html = `
      <div>
        <h3>令和３年</h3>
        <p>◆第2回定例会</p>
        <p><a href="/wp-content/uploads/2021/06/r3-2-6.14.pdf">初日（R3.6.14）</a></p>
      </div>
    `;

    const result = parsePdfLinksFromList(html, 2021);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.yufu.oita.jp/wp-content/uploads/2021/06/r3-2-6.14.pdf",
    );
    expect(result[0]!.heldOn).toBe("2021-06-14");
  });

  it("PDF リンクがないページでは空配列を返す", () => {
    const html = `<html><body><p>まだ公開されていません。</p></body></html>`;
    const result = parsePdfLinksFromList(html, 2025);
    expect(result).toEqual([]);
  });

  it("h3 の年度見出しがない場合は PDF を収集しない", () => {
    const html = `
      <p>◆第1回定例会</p>
      <p><a href="/uploads/files/2025/07/test.pdf">初日（R7.2.25）</a></p>
    `;
    const result = parsePdfLinksFromList(html, 2025);
    expect(result).toEqual([]);
  });

  it("セッションラベルがない場合は PDF を収集しない", () => {
    const html = `
      <h3>令和７年</h3>
      <p><a href="/uploads/files/2025/07/test.pdf">初日（R7.2.25）</a></p>
    `;
    const result = parsePdfLinksFromList(html, 2025);
    expect(result).toEqual([]);
  });

  it("平成年度の PDF リンクを正しく収集する", () => {
    const html = `
      <div>
        <h3>平成17年</h3>
        <p>◆第3回定例会</p>
        <p><a href="/wp-content/uploads/2005/09/h17-3-9.5.pdf">初日（H17.9.5）</a></p>
      </div>
    `;

    const result = parsePdfLinksFromList(html, 2005);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2005-09-05");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("複数の会議を含む HTML を正しく処理する", () => {
    const html = `
      <div>
        <h3>令和６年</h3>
        <p>◆第1回定例会</p>
        <p><a href="/uploads/files/2024/03/R6-1-3.4.pdf">初日（R6.3.4）</a></p>
        <p><a href="/uploads/files/2024/03/R6-2-3.7.pdf">２日目（R6.3.7）</a></p>
        <p>◆第1回臨時会</p>
        <p><a href="/uploads/files/2024/04/R6-rinj-4.8.pdf">開閉会（R6.4.8）</a></p>
      </div>
    `;

    const result = parsePdfLinksFromList(html, 2024);

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[2]!.meetingType).toBe("extraordinary");
    expect(result[2]!.heldOn).toBe("2024-04-08");
  });
});
