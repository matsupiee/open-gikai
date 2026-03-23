import { describe, it, expect } from "vitest";
import { parseLinkText, parseH2Year, parseListPage, filterByYear } from "./list";

describe("parseLinkText", () => {
  it("定例会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "令和7年3月議会定例会 (PDFファイル: 2.4MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年3月議会定例会");
    expect(result!.year).toBe(2025);
    expect(result!.month).toBe(3);
    expect(result!.section).toBe("定例会");
  });

  it("臨時会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "令和7年第1回臨時会 (PDFファイル: 440.7KB)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年第1回臨時会");
    expect(result!.year).toBe(2025);
    expect(result!.month).toBeNull();
    expect(result!.section).toBe("臨時会");
  });

  it("平成の定例会をパースする", () => {
    const result = parseLinkText(
      "平成17年12月議会定例会 (PDFファイル: 1.2MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2005);
    expect(result!.month).toBe(12);
    expect(result!.section).toBe("定例会");
  });

  it("令和元年に対応する", () => {
    const result = parseLinkText(
      "令和元年9月議会定例会 (PDFファイル: 1.0MB)"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.month).toBe(9);
  });

  it("パースできないテキストは null を返す", () => {
    expect(parseLinkText("議員名簿")).toBeNull();
  });
});

describe("parseH2Year", () => {
  it("令和の年を抽出する", () => {
    expect(parseH2Year("令和7年議会議事録")).toBe(2025);
  });

  it("平成の年を抽出する", () => {
    expect(parseH2Year("平成17年議会議事録")).toBe(2005);
  });

  it("令和元年に対応する", () => {
    expect(parseH2Year("令和元年議会議事録")).toBe(2019);
  });

  it("年が含まれない場合は null を返す", () => {
    expect(parseH2Year("議会議事録")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年議会議事録</span></span></span></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会議事録</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/R7_3_gikaiteireikai.pdf">令和7年3月議会定例会 (PDFファイル: 2.4MB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/teireikai0706.pdf">令和7年6月議会定例会 (PDFファイル: 2.8MB)</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.iijima.lg.jp/material/files/group/10/R7_3_gikaiteireikai.pdf"
    );
    expect(meetings[0]!.title).toBe("令和7年3月議会定例会");
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[0]!.section).toBe("定例会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.iijima.lg.jp/material/files/group/10/teireikai0706.pdf"
    );
    expect(meetings[1]!.title).toBe("令和7年6月議会定例会");
    expect(meetings[1]!.heldOn).toBe("2025-06-01");
  });

  it("臨時会リンクを正しく抽出する", () => {
    const html = `
      <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年議会議事録</span></span></span></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">臨時会議事録</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/R7-1rinji.pdf">令和7年第1回臨時会 (PDFファイル: 440.7KB)</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第1回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-01-01");
    expect(meetings[0]!.section).toBe("臨時会");
  });

  it("複数年度のセクションを正しく処理する", () => {
    const html = `
      <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年議会議事録</span></span></span></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会議事録</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/R7_3.pdf">令和7年3月議会定例会 (PDFファイル: 2.4MB)</a></p>
      <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年議会議事録</span></span></span></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会議事録</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/R6_12.pdf">令和6年12月議会定例会 (PDFファイル: 1.8MB)</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[1]!.heldOn).toBe("2024-12-01");
  });

  it("プロトコル相対パスを https に変換する", () => {
    const html = `
      <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年議会議事録</span></span></span></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">定例会議事録</span></span></span></h3>
      <p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/test.pdf">令和7年3月議会定例会 (PDFファイル: 1MB)</a></p>
    `;

    const meetings = parseListPage(html);

    expect(meetings[0]!.pdfUrl).toMatch(/^https:\/\//);
  });
});

describe("filterByYear", () => {
  it("指定年のミーティングのみ返す", () => {
    const meetings = [
      { pdfUrl: "a.pdf", title: "A", heldOn: "2025-03-01", section: "定例会" },
      { pdfUrl: "b.pdf", title: "B", heldOn: "2024-12-01", section: "定例会" },
      { pdfUrl: "c.pdf", title: "C", heldOn: "2025-06-01", section: "定例会" },
    ];

    const result = filterByYear(meetings, 2025);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("A");
    expect(result[1]!.title).toBe("C");
  });
});
