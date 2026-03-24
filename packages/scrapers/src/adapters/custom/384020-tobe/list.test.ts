import { describe, expect, it } from "vitest";
import {
  parseYearPageLinks,
  extractYearFromH1,
  parseH2Text,
  parsePdfLinksWithYear,
} from "./list";
import { parseWarekiYear, detectMeetingType } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年定例会・臨時会")).toBe(2024);
    expect(parseWarekiYear("令和5年定例会・臨時会")).toBe(2023);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年定例会・臨時会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年定例会・臨時会")).toBe(2018);
    expect(parseWarekiYear("平成17年定例会・臨時会")).toBe(2005);
  });

  it("平成31年(令和元年)パターンを変換する", () => {
    expect(parseWarekiYear("平成31年(令和元年)定例会・臨時会")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("会議録一覧")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会はplenaryを返す", () => {
    expect(detectMeetingType("第4回定例会（12月5日から12月13日まで）")).toBe("plenary");
  });

  it("臨時会はextraordinaryを返す", () => {
    expect(detectMeetingType("第3回臨時会（6月27日）")).toBe("extraordinary");
  });

  it("委員会はcommitteeを返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseYearPageLinks", () => {
  it("年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html">令和8年定例会・臨時会</a></li>
        <li><a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/4550.html">令和7年定例会・臨時会</a></li>
        <li><a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/3677.html">令和6年定例会・臨時会</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      url: "https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html",
      id: "5259",
    });
    expect(result[1]).toEqual({
      url: "https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/4550.html",
      id: "4550",
    });
    expect(result[2]).toEqual({
      url: "https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/3677.html",
      id: "3677",
    });
  });

  it("相対パス形式のリンクも抽出する", () => {
    const html = `
      <a href="/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html">令和8年</a>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      url: "https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html",
      id: "5259",
    });
  });

  it("重複するIDを除外する", () => {
    const html = `
      <a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html">令和8年</a>
      <a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html">令和8年</a>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearPageLinks(html)).toEqual([]);
  });
});

describe("extractYearFromH1", () => {
  it("令和年度を抽出する", () => {
    const html = `
      <h1 class="title"><span class="bg"><span class="bg2">令和6年定例会・臨時会</span></span></h1>
    `;
    expect(extractYearFromH1(html)).toBe(2024);
  });

  it("平成年度を抽出する", () => {
    const html = `
      <h1 class="title"><span class="bg"><span class="bg2">平成30年定例会・臨時会</span></span></h1>
    `;
    expect(extractYearFromH1(html)).toBe(2018);
  });

  it("平成31年(令和元年)を抽出する", () => {
    const html = `
      <h1 class="title"><span>平成31年(令和元年)定例会・臨時会</span></h1>
    `;
    expect(extractYearFromH1(html)).toBe(2019);
  });

  it("h1タグがない場合はnullを返す", () => {
    const html = "<p>No h1 here</p>";
    expect(extractYearFromH1(html)).toBeNull();
  });
});

describe("parseH2Text", () => {
  it("定例会（期間指定）をパースする", () => {
    const result = parseH2Text("第4回定例会（12月5日から12月13日まで）");
    expect(result).not.toBeNull();
    expect(result!.session).toBe(4);
    expect(result!.type).toBe("定例会");
    expect(result!.month).toBe(12);
    expect(result!.startDay).toBe(5);
  });

  it("臨時会（1日）をパースする", () => {
    const result = parseH2Text("第3回臨時会（6月27日）");
    expect(result).not.toBeNull();
    expect(result!.session).toBe(3);
    expect(result!.type).toBe("臨時会");
    expect(result!.month).toBe(6);
    expect(result!.startDay).toBe(27);
  });

  it("定例会（9月）をパースする", () => {
    const result = parseH2Text("第3回定例会（9月5日から9月13日まで）");
    expect(result).not.toBeNull();
    expect(result!.session).toBe(3);
    expect(result!.month).toBe(9);
    expect(result!.startDay).toBe(5);
  });

  it("パターンに合致しない場合はnullを返す", () => {
    expect(parseH2Text("会議録一覧")).toBeNull();
    expect(parseH2Text("")).toBeNull();
  });
});

describe("parsePdfLinksWithYear", () => {
  it("PDF リンクを抽出する（会議録のみ）", () => {
    const html = `
      <h2><span class="bg"><span class="bg2"><span class="bg3">第4回定例会（12月5日から12月13日まで）</span></span></span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/117.pdf">第4回定例会会議結果 (PDFファイル: 140.5KB)</a></p>
    `;

    const result = parsePdfLinksWithYear(html, "3677", 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tobe.ehime.jp/material/files/group/17/116.pdf"
    );
    expect(result[0]!.title).toBe("第4回定例会（12月5日から12月13日まで）");
    expect(result[0]!.heldOn).toBe("2024-12-05");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.yearPageId).toBe("3677");
  });

  it("臨時会の meetingType が extraordinary になる", () => {
    const html = `
      <h2><span class="bg3">第3回臨時会（6月27日）</span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/90.pdf">第3回臨時会会議録 (PDFファイル: 267.4KB)</a></p>
    `;

    const result = parsePdfLinksWithYear(html, "3677", 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-06-27");
  });

  it("複数の h2 セクションから PDF を取得する", () => {
    const html = `
      <h2><span>第4回定例会（12月5日から12月13日まで）</span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/117.pdf">第4回定例会会議結果 (PDFファイル: 140.5KB)</a></p>
      <h2><span>第3回定例会（9月5日から9月13日まで）</span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/105.pdf">第3回定例会会議録 (PDFファイル: 1.1MB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/107.pdf">第3回定例会会議結果 (PDFファイル: 135.4KB)</a></p>
    `;

    const result = parsePdfLinksWithYear(html, "3677", 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tobe.ehime.jp/material/files/group/17/116.pdf"
    );
    expect(result[0]!.heldOn).toBe("2024-12-05");
    expect(result[1]!.pdfUrl).toBe(
      "https://www.town.tobe.ehime.jp/material/files/group/17/105.pdf"
    );
    expect(result[1]!.heldOn).toBe("2024-09-05");
  });

  it("重複する PDF URL を除外する", () => {
    const html = `
      <h2><span>第4回定例会（12月5日から12月13日まで）</span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
    `;

    const result = parsePdfLinksWithYear(html, "3677", 2024);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2><span>第4回定例会（12月5日から12月13日まで）</span></h2>
      <p>会議録は準備中です。</p>
    `;

    const result = parsePdfLinksWithYear(html, "3677", 2024);
    expect(result).toEqual([]);
  });

  it("プロトコル相対 URL を https に変換する", () => {
    const html = `
      <h2><span>第4回定例会（12月5日から12月13日まで）</span></h2>
      <p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
    `;

    const result = parsePdfLinksWithYear(html, "3677", 2024);
    expect(result[0]!.pdfUrl).toMatch(/^https:\/\//);
  });
});
