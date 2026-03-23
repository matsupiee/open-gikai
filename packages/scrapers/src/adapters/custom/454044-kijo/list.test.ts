import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseDateFromLinkText,
  parseSectionFromLinkText,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/2437.html">会議録（令和6年）</a></li>
        <li><a href="https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/1975.html">会議録（令和5年）</a></li>
        <li><a href="https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/1159.html">会議録(平成23年～平成25年)</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("会議録（令和6年）");
    expect(pages[0]!.url).toBe(
      "https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/2437.html"
    );
    expect(pages[1]!.label).toBe("会議録（令和5年）");
    expect(pages[2]!.label).toBe("会議録(平成23年～平成25年)");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/2437.html">会議録（令和6年）</a>
      <a href="https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/other.html">お知らせ</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("会議録（令和6年）");
  });

  it("相対パスのリンクを絶対URLに変換する", () => {
    const html = `
      <a href="/gyouseizyouhou/gikai/kaigiroku/2437.html">会議録（令和6年）</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toBe(
      "https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/2437.html"
    );
  });
});

describe("parseDateFromLinkText", () => {
  it("月日を正しく抽出する", () => {
    expect(parseDateFromLinkText("第2回定例会 会議録 3月8日 (PDFファイル: 615.3KB)", 2024)).toBe(
      "2024-03-08"
    );
  });

  it("12月の日付を正しく抽出する", () => {
    expect(parseDateFromLinkText("第7回定例会 会議録 12月6日 (PDFファイル: 492.1KB)", 2024)).toBe(
      "2024-12-06"
    );
  });

  it("1桁の月日を0埋めする", () => {
    expect(parseDateFromLinkText("第1回臨時会 会議録 2月6日 (PDFファイル: 280.3KB)", 2024)).toBe(
      "2024-02-06"
    );
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromLinkText("第1回臨時会 目次 (PDFファイル: 68.7KB)", 2024)).toBeNull();
  });
});

describe("parseSectionFromLinkText", () => {
  it("定例会のセクションを抽出する", () => {
    expect(parseSectionFromLinkText("第2回定例会 会議録 3月8日")).toBe("第2回定例会");
  });

  it("臨時会のセクションを抽出する", () => {
    expect(parseSectionFromLinkText("第1回臨時会 会議録 2月6日")).toBe("第1回臨時会");
  });

  it("第7回のセクションを抽出する", () => {
    expect(parseSectionFromLinkText("第7回定例会 会議録 12月6日")).toBe("第7回定例会");
  });

  it("パターンに合わない場合は null を返す", () => {
    expect(parseSectionFromLinkText("目次 (PDFファイル: 68.7KB)")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("会議録 PDF リンクを抽出し目次はスキップする", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/R6-mokuji.pdf">第1回臨時会 目次 (PDFファイル: 68.7KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/R6-1.pdf">第1回臨時会 会議録 2月6日 (PDFファイル: 280.3KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/R602mokuji.pdf">第2回定例会 目次 (PDFファイル: 76.4KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/R602ichinichime.pdf">第2回定例会 会議録 3月8日 (PDFファイル: 615.3KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kijo.lg.jp/material/files/group/5/R6-1.pdf"
    );
    expect(meetings[0]!.title).toBe("令和6年第1回臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-02-06");
    expect(meetings[0]!.section).toBe("第1回臨時会");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.kijo.lg.jp/material/files/group/5/R602ichinichime.pdf"
    );
    expect(meetings[1]!.title).toBe("令和6年第2回定例会");
    expect(meetings[1]!.heldOn).toBe("2024-03-08");
    expect(meetings[1]!.section).toBe("第2回定例会");
  });

  it("複数日の定例会を全て抽出する", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/dai4kaiteireikai1nichime.pdf">第4回定例会 会議録 6月7日 (PDFファイル: 437.9KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/dai4kaiteireikai2nichime.pdf">第4回定例会 会議録 6月10日 (PDFファイル: 527.3KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/dai4kaiteireikai3nichime.pdf">第4回定例会 会議録 6月13日 (PDFファイル: 251.1KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-06-07");
    expect(meetings[1]!.heldOn).toBe("2024-06-10");
    expect(meetings[2]!.heldOn).toBe("2024-06-13");
  });

  it("平成の年度を正しく変換する", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/test.pdf">第3回定例会 会議録 3月4日 (PDFファイル: 500.0KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2017);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("平成29年第3回定例会");
    expect(meetings[0]!.heldOn).toBe("2017-03-04");
  });

  it("令和元年を正しく変換する", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/test.pdf">第3回定例会 会議録 6月5日 (PDFファイル: 500.0KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和元年第3回定例会");
  });

  it("日付が取得できないリンクはスキップする", () => {
    const html = `
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/extra.pdf">審決書 (PDFファイル: 50.0KB)</a></p>
      <p class="file-link-item"><a class="pdf" href="//www.town.kijo.lg.jp/material/files/group/5/R6-1.pdf">第1回臨時会 会議録 2月6日 (PDFファイル: 280.3KB)</a></p>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("第1回臨時会");
  });
});
