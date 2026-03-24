import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年")).toBe(2019);
    expect(parseWarekiYear("令和1年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成29年")).toBe(2017);
    expect(parseWarekiYear("平成30年")).toBe(2018);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和7年第4回定例会")).toBe("plenary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });
});

describe("parseListPage", () => {
  it("一覧ページから定例会 PDF リンクを抽出する", () => {
    const html = `
      <div id="main">
        <h2>令和7年</h2>
        <p>　○<a href="/fs/6/1/2/9/0/7/_/%E4%BC%9A%E8%AD%B0%E9%8C%B2HP%E7%94%A8%20R07-4.pdf">第4回定例会 (PDF 614KB)</a></p>
        <p>　○<a href="/fs/6/1/1/7/8/8/_/R07-4%E7%94%BA%E9%95%B7%E8%AB%B8%E5%A0%B1%E5%91%8A.pdf">第4回町長諸報告 (PDF 22.8KB)</a></p>
        <p>　○<a href="/fs/6/1/0/0/0/0/_/R07-3.pdf">第3回定例会 (PDF 500KB)</a></p>
      </div>
    `;

    const result = parseListPage(html, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年第4回定例会");
    expect(result[0]!.heldOn).toBe("2025-01-01");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.kitajima.lg.jp/fs/6/1/2/9/0/7/_/%E4%BC%9A%E8%AD%B0%E9%8C%B2HP%E7%94%A8%20R07-4.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfPath).toBe(
      "/fs/6/1/2/9/0/7/_/%E4%BC%9A%E8%AD%B0%E9%8C%B2HP%E7%94%A8%20R07-4.pdf",
    );
    expect(result[1]!.title).toBe("令和7年第3回定例会");
    expect(result[1]!.heldOn).toBe("2025-01-01");
  });

  it("町長諸報告・所信表明は除外する", () => {
    const html = `
      <h2>令和6年</h2>
      <p>　○<a href="/fs/1/2/3/4/5/6/_/R06-1.pdf">第1回定例会 (PDF 400KB)</a></p>
      <p>　○<a href="/fs/1/2/3/4/5/7/_/R06-1-houkoku.pdf">第1回町長諸報告 (PDF 20KB)</a></p>
      <p>　○<a href="/fs/1/2/3/4/5/8/_/shoshin.pdf">令和6年町長所信表明 (PDF 30KB)</a></p>
    `;

    const result = parseListPage(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第1回定例会");
  });

  it("targetYear が指定された場合は指定年のみ返す", () => {
    const html = `
      <h2>令和7年</h2>
      <p>　○<a href="/fs/1/0/0/0/0/1/_/R07-1.pdf">第1回定例会 (PDF 400KB)</a></p>
      <h2>令和6年</h2>
      <p>　○<a href="/fs/1/0/0/0/0/2/_/R06-1.pdf">第1回定例会 (PDF 400KB)</a></p>
    `;

    const result2025 = parseListPage(html, 2025);
    expect(result2025).toHaveLength(1);
    expect(result2025[0]!.title).toBe("令和7年第1回定例会");

    const result2024 = parseListPage(html, 2024);
    expect(result2024).toHaveLength(1);
    expect(result2024[0]!.title).toBe("令和6年第1回定例会");
  });

  it("targetYear が null の場合は全年度を返す", () => {
    const html = `
      <h2>令和7年</h2>
      <p>　○<a href="/fs/1/0/0/0/0/1/_/R07-1.pdf">第1回定例会 (PDF 400KB)</a></p>
      <h2>令和6年</h2>
      <p>　○<a href="/fs/1/0/0/0/0/2/_/R06-1.pdf">第1回定例会 (PDF 400KB)</a></p>
    `;

    const result = parseListPage(html, null);
    expect(result).toHaveLength(2);
  });

  it("平成年の PDF リンクを抽出する", () => {
    const html = `
      <h2>平成29年</h2>
      <p>　○<a href="/fs/1/0/0/0/0/3/_/H29-4.pdf">第4回定例会 (PDF 350KB)</a></p>
    `;

    const result = parseListPage(html, 2017);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("平成29年第4回定例会");
    expect(result[0]!.heldOn).toBe("2017-01-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>まだ会議録は掲載されていません。</p>`;
    expect(parseListPage(html, 2025)).toEqual([]);
  });

  it("h2 内に和暦年がない場合はスキップする", () => {
    const html = `
      <h2>会議録一覧</h2>
      <p>　○<a href="/fs/1/0/0/0/0/4/_/doc.pdf">第1回定例会 (PDF 400KB)</a></p>
    `;

    const result = parseListPage(html, 2025);
    expect(result).toHaveLength(0);
  });
});
