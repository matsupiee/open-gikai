import { describe, expect, it } from "vitest";
import { parsePdfLinks } from "./list";
import { parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第1回")).toBe(2025);
    expect(parseWarekiYear("令和3年第1回")).toBe(2021);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第1回")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第2回")).toBe(2018);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("parsePdfLinks", () => {
  it("定例会PDFリンクを抽出しメタ情報をパースする", () => {
    const html = `
      <a href="/uploaded/attachment/11393.pdf">令和7年第3回定例会第1日目（9月4日）(PDF:2.1MB)</a>
      <a href="/uploaded/attachment/11394.pdf">令和7年第3回定例会第2日目（9月5日）(PDF:1.8MB)</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和7年第3回定例会第1日目（9月4日）",
      heldOn: "2025-09-04",
      pdfUrl: "https://www.town.sera.hiroshima.jp/uploaded/attachment/11393.pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "令和7年第3回定例会第2日目（9月5日）",
      heldOn: "2025-09-05",
      pdfUrl: "https://www.town.sera.hiroshima.jp/uploaded/attachment/11394.pdf",
      meetingType: "plenary",
    });
  });

  it("臨時会PDFリンクを正しく分類する", () => {
    const html = `
      <a href="/uploaded/attachment/9000.pdf">令和6年第1回臨時会（4月10日）(PDF:500KB)</a>
    `;

    const result = parsePdfLinks(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-04-10");
  });

  it("targetYear でフィルタリングする", () => {
    const html = `
      <a href="/uploaded/attachment/11393.pdf">令和7年第3回定例会第1日目（9月4日）</a>
      <a href="/uploaded/attachment/9500.pdf">令和6年第4回定例会第1日目（12月3日）</a>
      <a href="/uploaded/attachment/3603.pdf">令和3年第1回定例会第1日目（3月1日）</a>
    `;

    const result2024 = parsePdfLinks(html, 2024);
    expect(result2024).toHaveLength(1);
    expect(result2024[0]!.heldOn).toBe("2024-12-03");

    const result2025 = parsePdfLinks(html, 2025);
    expect(result2025).toHaveLength(1);
    expect(result2025[0]!.heldOn).toBe("2025-09-04");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>現在準備中です</p>";
    expect(parsePdfLinks(html)).toEqual([]);
  });

  it("メタ情報が抽出できないリンクはスキップする", () => {
    const html = `
      <a href="/uploaded/attachment/1000.pdf">不明なタイトル.pdf</a>
      <a href="/uploaded/attachment/11393.pdf">令和7年第3回定例会第1日目（9月4日）</a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2025-09-04");
  });

  it("令和元年を正しく変換する", () => {
    const html = `
      <a href="/uploaded/attachment/3000.pdf">令和元年第1回定例会第1日目（3月5日）</a>
    `;

    const result = parsePdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2019-03-05");
  });

  it("複数の会議（定例会+臨時会）を正しく処理する", () => {
    const html = `
      <a href="/uploaded/attachment/10001.pdf">令和6年第1回定例会第1日目（3月4日）</a>
      <a href="/uploaded/attachment/10002.pdf">令和6年第1回臨時会（5月15日）</a>
      <a href="/uploaded/attachment/10003.pdf">令和6年第2回定例会第1日目（6月10日）</a>
    `;

    const result = parsePdfLinks(html, 2024);

    expect(result).toHaveLength(3);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2024-03-04");
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[1]!.heldOn).toBe("2024-05-15");
    expect(result[2]!.meetingType).toBe("plenary");
    expect(result[2]!.heldOn).toBe("2024-06-10");
  });
});
