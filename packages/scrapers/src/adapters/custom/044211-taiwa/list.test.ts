import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("指定年に対応する年度ページURLを返す", () => {
    const html = `
      <article id="contents">
        <a href="https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/4126.html">令和7年大和町議会会議録</a>
        <a href="https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/3867.html">令和6年大和町議会会議録</a>
        <a href="https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/2824.html">令和5年大和町議会会議録</a>
      </article>
    `;

    const url = parseTopPage(html, 2024);
    expect(url).toBe("https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/3867.html");
  });

  it("相対パスのURLも絶対URLに変換する", () => {
    const html = `
      <article id="contents">
        <a href="/choseijoho/gikai/kaigiroku/3867.html">令和6年大和町議会会議録</a>
      </article>
    `;

    const url = parseTopPage(html, 2024);
    expect(url).toBe("https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/3867.html");
  });

  it("対象年が存在しない場合は null を返す", () => {
    const html = `
      <article id="contents">
        <a href="https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/3867.html">令和6年大和町議会会議録</a>
      </article>
    `;

    const url = parseTopPage(html, 2025);
    expect(url).toBeNull();
  });

  it("令和7年（2025年）のリンクを取得できる", () => {
    const html = `
      <article id="contents">
        <a href="https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/4126.html">令和7年大和町議会会議録</a>
        <a href="https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/3867.html">令和6年大和町議会会議録</a>
      </article>
    `;

    const url = parseTopPage(html, 2025);
    expect(url).toBe("https://www.town.taiwa.miyagi.jp/choseijoho/gikai/kaigiroku/4126.html");
  });
});

describe("parseYearPage", () => {
  it("定例会議の PDF リンクを抽出する", () => {
    const html = `
      <article id="contents">
        <h1 class="title">令和6年大和町議会会議録</h1>
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年12月定例会議</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-12t-01-1202.pdf">
            12月2日分（再開、諸般の報告、行政報告、一般質問） (PDFファイル: 1.2MB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-12t-02-1213.pdf">
            12月13日分（議案の上程、委員会付託等） (PDFファイル: 0.8MB)
          </a>
        </p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.taiwa.miyagi.jp/material/files/group/21/r06-12t-01-1202.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-02");
    expect(meetings[0]!.title).toBe(
      "令和6年12月定例会議 12月2日分（再開、諸般の報告、行政報告、一般質問）"
    );
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.heldOn).toBe("2024-12-13");
    expect(meetings[1]!.meetingType).toBe("plenary");
  });

  it("随時会議の PDF リンクは meetingType が extraordinary になる", () => {
    const html = `
      <article id="contents">
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年12月随時会議</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-12r-1223.pdf">
            12月23日分（随時会議） (PDFファイル: 0.5MB)
          </a>
        </p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
    expect(meetings[0]!.heldOn).toBe("2024-12-23");
  });

  it("委員会の PDF リンクは meetingType が committee になる", () => {
    const html = `
      <article id="contents">
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年予算特別委員会</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-y-01-0304.pdf">
            3月4日分（予算審議） (PDFファイル: 1.5MB)
          </a>
        </p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("複数の会議種別ブロックを正しく処理する", () => {
    const html = `
      <article id="contents">
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年9月定例会議</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-09t-01-0906.pdf">
            9月6日分（一般質問） (PDFファイル: 1.0MB)
          </a>
        </p>
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年決算特別委員会</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-k-01-0910.pdf">
            9月10日分（決算審議） (PDFファイル: 1.3MB)
          </a>
        </p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[0]!.title).toContain("令和6年9月定例会議");
    expect(meetings[1]!.meetingType).toBe("committee");
    expect(meetings[1]!.title).toContain("令和6年決算特別委員会");
  });

  it("bg3 クラスのない h2 はスキップする", () => {
    const html = `
      <article id="contents">
        <h2><span>タイトルなしの h2</span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/test.pdf">
            1月5日分（テスト） (PDFファイル: 0.1MB)
          </a>
        </p>
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年3月定例会議</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-03t-01-0301.pdf">
            3月1日分（一般質問） (PDFファイル: 1.0MB)
          </a>
        </p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toContain("令和6年3月定例会議");
  });

  it("PDFファイルサイズ情報がタイトルから除去される", () => {
    const html = `
      <article id="contents">
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年12月定例会議</span></span></span></h2>
        <p class="file-link-item">
          <a class="pdf" href="//www.town.taiwa.miyagi.jp/material/files/group/21/r06-12t-01-1202.pdf">
            12月2日分（一般質問） (PDFファイル: 1.2MB)
          </a>
        </p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings[0]!.title).not.toContain("PDFファイル");
    expect(meetings[0]!.title).toBe("令和6年12月定例会議 12月2日分（一般質問）");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <article id="contents">
        <h2><span class="bg"><span class="bg2"><span class="bg3">令和6年12月定例会議</span></span></span></h2>
        <p>会議録は準備中です。</p>
      </article>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });
});
