import { describe, it, expect } from "vitest";
import { parseLinkText, parseListPage } from "./list";

describe("parseLinkText", () => {
  it("令和6年第1回定例会を正しくパースする", () => {
    const result = parseLinkText(
      "令和6年　第1回定例会会議録 [PDFファイル／1.2MB]",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("令和5年第1回臨時会を正しくパースする", () => {
    const result = parseLinkText(
      "令和5年　第1回臨時会会議録 [PDFファイル／256KB]",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("臨時会");
  });

  it("令和4年第6回定例会を正しくパースする", () => {
    const result = parseLinkText(
      "令和4年　第6回定例会会議録 [PDFファイル／2.78MB]",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2022);
    expect(result!.session).toBe(6);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("令和元年を正しくパースする", () => {
    const result = parseLinkText("令和元年　第1回定例会会議録 [PDFファイル]");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
  });

  it("平成30年を正しくパースする", () => {
    const result = parseLinkText(
      "平成30年　第1回定例会会議録 [PDFファイル]",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2018);
  });

  it("全角数字を正しくパースする", () => {
    const result = parseLinkText(
      "令和６年　第１回定例会会議録 [PDFファイル]",
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.session).toBe(1);
  });

  it("議会情報のないテキストは null を返す", () => {
    const result = parseLinkText("高原町議会会議録一覧");
    expect(result).toBeNull();
  });

  it("PDFファイルでないテキストは null を返す", () => {
    const result = parseLinkText("議会活動報告");
    expect(result).toBeNull();
  });
});

describe("parseListPage", () => {
  it("指定年の PDF リンクを正しく抽出する", () => {
    const html = `
      <html><body>
      <a href="/uploaded/attachment/4285.pdf">令和6年　第4回定例会会議録 [PDFファイル／2MB]</a>
      <a href="/uploaded/attachment/4284.pdf">令和6年　第3回定例会会議録 [PDFファイル／1.5MB]</a>
      <a href="/uploaded/attachment/3642.pdf">令和5年　第2回定例会会議録 [PDFファイル／1MB]</a>
      </body></html>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.takaharu.lg.jp/uploaded/attachment/4284.pdf",
    );
    expect(meetings[0]!.title).toBe("令和6年第3回定例会");
    expect(meetings[0]!.heldOn).toBe("2024-01-01");
    expect(meetings[0]!.meetingKind).toBe("定例会");
    expect(meetings[0]!.session).toBe(3);

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.takaharu.lg.jp/uploaded/attachment/4285.pdf",
    );
    expect(meetings[1]!.session).toBe(4);
  });

  it("臨時会を正しく抽出する", () => {
    const html = `
      <a href="/uploaded/attachment/3250.pdf">令和5年　第1回臨時会会議録 [PDFファイル／199KB]</a>
      <a href="/uploaded/attachment/3642.pdf">令和5年　第2回定例会会議録 [PDFファイル／1MB]</a>
    `;

    const meetings = parseListPage(html, 2023);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.meetingKind).toBe("臨時会");
    expect(meetings[1]!.meetingKind).toBe("定例会");
  });

  it("他の年のリンクをスキップする", () => {
    const html = `
      <a href="/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/3250.pdf">令和5年　第1回臨時会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("4282.pdf");
  });

  it("session 昇順にソートされる", () => {
    const html = `
      <a href="/uploaded/attachment/4285.pdf">令和6年　第4回定例会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/4283.pdf">令和6年　第2回定例会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/4284.pdf">令和6年　第3回定例会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(4);
    expect(meetings[0]!.session).toBe(1);
    expect(meetings[1]!.session).toBe(2);
    expect(meetings[2]!.session).toBe(3);
    expect(meetings[3]!.session).toBe(4);
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("year が null の場合は全件返す", () => {
    const html = `
      <a href="/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/3250.pdf">令和5年　第1回臨時会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/3211.pdf">令和4年　第1回定例会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, null);

    expect(meetings).toHaveLength(3);
  });

  it("絶対 URL のリンクはそのまま使用する", () => {
    const html = `
      <a href="https://www.town.takaharu.lg.jp/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.takaharu.lg.jp/uploaded/attachment/4282.pdf",
    );
  });

  it("uploaded/attachment 以外の PDF はスキップする", () => {
    const html = `
      <a href="/other/path/document.pdf">関係ないPDF</a>
      <a href="/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("4282.pdf");
  });

  it("heldOn が YYYY-01-01 形式で設定される", () => {
    const html = `
      <a href="/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings[0]!.heldOn).toBe("2024-01-01");
  });

  it("タイトルが正しく生成される", () => {
    const html = `
      <a href="/uploaded/attachment/4282.pdf">令和6年　第1回定例会会議録 [PDFファイル]</a>
      <a href="/uploaded/attachment/3250.pdf">令和5年　第1回臨時会会議録 [PDFファイル]</a>
    `;

    const meetingsR6 = parseListPage(html, 2024);
    expect(meetingsR6[0]!.title).toBe("令和6年第1回定例会");

    const meetingsR5 = parseListPage(html, 2023);
    expect(meetingsR5[0]!.title).toBe("令和5年第1回臨時会");
  });

  it("令和元年のタイトルが正しく生成される", () => {
    const html = `
      <a href="/uploaded/attachment/100.pdf">令和元年　第1回定例会会議録 [PDFファイル]</a>
    `;

    const meetings = parseListPage(html, 2019);
    expect(meetings[0]!.title).toBe("令和元年第1回定例会");
  });
});
