import { describe, it, expect } from "vitest";
import {
  parseIndexLinks,
  parseIntermediatePage,
  extractDateFromPdfFilename,
} from "./list";

describe("parseIndexLinks", () => {
  it("一覧ページから中間ページリンクを抽出する", () => {
    const html = `
      <a href="./78_127.html">令和8年第1回臨時会</a>
      <a href="./78_126.html">令和7年第5回臨時会</a>
      <a href="./78_125.html">令和7年第4回定例会</a>
    `;

    const links = parseIndexLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.pageNum).toBe("127");
    expect(links[0]!.title).toBe("令和8年第1回臨時会");
    expect(links[0]!.href).toBe(
      "http://www.town.nishiizu.shizuoka.jp/kakuka/gikai/gijiroku/78_127.html"
    );
    expect(links[1]!.pageNum).toBe("126");
    expect(links[2]!.pageNum).toBe("125");
  });

  it("重複するページ番号は1件のみ取得する", () => {
    const html = `
      <a href="./78_127.html">令和8年第1回臨時会</a>
      <a href="./78_127.html">令和8年第1回臨時会（重複）</a>
    `;

    const links = parseIndexLinks(html);
    expect(links).toHaveLength(1);
  });

  it("78_ パターン以外のリンクは無視する", () => {
    const html = `
      <a href="./78_127.html">令和8年第1回臨時会</a>
      <a href="./index.html">トップページへ</a>
      <a href="./other.html">その他</a>
    `;

    const links = parseIndexLinks(html);
    expect(links).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div>会議録はありません</div>`;
    expect(parseIndexLinks(html)).toEqual([]);
  });
});

describe("extractDateFromPdfFilename", () => {
  it("8桁 YYYYMMDD パターンを解析する", () => {
    expect(extractDateFromPdfFilename(
      "http://example.com/pdf/gikai/2026/nishigi20260120_01ringi.pdf",
      null
    )).toBe("2026-01-20");
  });

  it("8桁パターン（12月）を解析する", () => {
    expect(extractDateFromPdfFilename(
      "http://example.com/pdf/gikai/2025/nishigi20251222_05ringi.pdf",
      null
    )).toBe("2025-12-22");
  });

  it("4桁 MMDD パターンを yearHint と組み合わせる", () => {
    expect(extractDateFromPdfFilename(
      "http://example.com/pdf/gikai/2025/nishigi1010_01ringi.pdf",
      2025
    )).toBe("2025-10-10");
  });

  it("4桁パターン（0709）を解析する", () => {
    expect(extractDateFromPdfFilename(
      "http://example.com/pdf/gikai/2025/nishigi0709_01.pdf",
      2025
    )).toBe("2025-07-09");
  });

  it("yearHint がない場合は 4 桁パターンは null を返す", () => {
    expect(extractDateFromPdfFilename(
      "http://example.com/pdf/gikai/2025/nishigi1010_01ringi.pdf",
      null
    )).toBeNull();
  });

  it("nishigi パターンにマッチしないファイル名は null を返す", () => {
    expect(extractDateFromPdfFilename(
      "http://example.com/pdf/gikai/2025/other_file.pdf",
      2025
    )).toBeNull();
  });
});

describe("parseIntermediatePage", () => {
  it("臨時会ページから PDF リンクと日付を抽出する", () => {
    const html = `
      <h1>令和8年第1回臨時会</h1>
      <p>開催日：令和8年1月20日</p>
      <a href="/pdf/gikai/2026/nishigi20260120_01ringi.pdf">会議録</a>
    `;

    const meetings = parseIntermediatePage(html, "令和8年第1回臨時会", "127");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.nishiizu.shizuoka.jp/pdf/gikai/2026/nishigi20260120_01ringi.pdf"
    );
    expect(meetings[0]!.title).toBe("令和8年第1回臨時会");
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.pageNum).toBe("127");
    expect(meetings[0]!.heldOn).toBe("2026-01-20");
  });

  it("定例会ページから複数 PDF リンクを抽出する", () => {
    const html = `
      <h1>令和7年第3回定例会</h1>
      <a href="/pdf/gikai/2025/nishigi0709_01.pdf">会議録1日目</a>
      <a href="/pdf/gikai/2025/nishigi0709_02.pdf">会議録2日目</a>
      <a href="/pdf/gikai/2025/nishigi0709_03.pdf">会議録3日目</a>
    `;

    const meetings = parseIntermediatePage(html, "令和7年第3回定例会", "123");

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toContain("nishigi0709_01.pdf");
    expect(meetings[1]!.pdfUrl).toContain("nishigi0709_02.pdf");
    expect(meetings[2]!.pdfUrl).toContain("nishigi0709_03.pdf");
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<h1>令和8年第1回臨時会</h1><p>準備中</p>`;
    const meetings = parseIntermediatePage(html, "令和8年第1回臨時会", "127");
    expect(meetings).toEqual([]);
  });

  it("PDF URL が絶対 URL の場合はそのまま使う", () => {
    const html = `
      <a href="http://www.town.nishiizu.shizuoka.jp/pdf/gikai/2026/nishigi20260120_01ringi.pdf">会議録</a>
    `;

    const meetings = parseIntermediatePage(html, "令和8年第1回臨時会", "127");
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.nishiizu.shizuoka.jp/pdf/gikai/2026/nishigi20260120_01ringi.pdf"
    );
  });

  it("和暦日付をテキストから解析する", () => {
    const html = `
      <h1>令和7年第2回臨時会</h1>
      <p>令和7年5月15日開催</p>
      <a href="/pdf/gikai/2025/nishigi0515_02ringi.pdf">会議録</a>
    `;

    const meetings = parseIntermediatePage(html, "令和7年第2回臨時会", "117");
    expect(meetings[0]!.heldOn).toBe("2025-05-15");
  });
});
