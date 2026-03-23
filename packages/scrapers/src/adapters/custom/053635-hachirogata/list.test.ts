import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseMeetingPage } from "./list";

describe("parseTopPage", () => {
  const BASE_URL =
    "https://www.town.hachirogata.akita.jp/gikai/1001560/index.html";

  it("年別一覧ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../gikai/1001560/1004240/index.html">令和7年八郎潟町議会議事録</a></li>
        <li><a href="../../gikai/1001560/1003971/index.html">令和6年八郎潟町議会議事録</a></li>
        <li><a href="../../gikai/1001560/1003760/index.html">令和5年八郎潟町議会議事録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html, BASE_URL);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年八郎潟町議会議事録");
    expect(pages[0]!.url).toBe(
      "https://www.town.hachirogata.akita.jp/gikai/1001560/1004240/index.html",
    );
    expect(pages[1]!.label).toBe("令和6年八郎潟町議会議事録");
    expect(pages[2]!.label).toBe("令和5年八郎潟町議会議事録");
  });

  it("議事録を含まないリンクはスキップする", () => {
    const html = `
      <a href="../../gikai/1001560/1001234/index.html">お知らせ</a>
      <a href="../../gikai/1001560/1004240/index.html">令和7年八郎潟町議会議事録</a>
    `;

    const pages = parseTopPage(html, BASE_URL);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年八郎潟町議会議事録");
  });

  it("絶対パスのリンクも処理する", () => {
    const html = `
      <a href="/gikai/1001560/1003971/index.html">令和6年八郎潟町議会議事録</a>
    `;

    const pages = parseTopPage(html, BASE_URL);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toBe(
      "https://www.town.hachirogata.akita.jp/gikai/1001560/1003971/index.html",
    );
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.hachirogata.akita.jp/gikai/1001560/1003971/index.html";

  it("会議ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../../gikai/1001560/1003971/1004139.html">令和6年八郎潟町議会12月定例会議事録</a></li>
        <li><a href="../../../gikai/1001560/1003971/1004082.html">令和6年八郎潟町議会9月定例会</a></li>
        <li><a href="../../../gikai/1001560/1003971/1003975.html">令和6年八郎潟町議会3月定例会</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.label).toBe("令和6年八郎潟町議会12月定例会議事録");
    expect(meetings[0]!.meetingId).toBe("1004139");
    expect(meetings[0]!.url).toBe(
      "https://www.town.hachirogata.akita.jp/gikai/1001560/1003971/1004139.html",
    );
    expect(meetings[1]!.meetingId).toBe("1004082");
    expect(meetings[2]!.meetingId).toBe("1003975");
  });

  it("臨時会のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../../gikai/1001560/1001833/1002991.html">令和3年八郎潟町議会第6回臨時会</a></li>
        <li><a href="../../../gikai/1001560/1001833/1002989.html">令和3年八郎潟町議会12月定例会</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.label).toBe("令和3年八郎潟町議会第6回臨時会");
    expect(meetings[0]!.meetingId).toBe("1002991");
    expect(meetings[1]!.label).toBe("令和3年八郎潟町議会12月定例会");
  });
});

describe("parseMeetingPage", () => {
  const PAGE_URL =
    "https://www.town.hachirogata.akita.jp/gikai/1001560/1003971/1004139.html";

  it("PDF リンクを抽出する", () => {
    const html = `
      <div class="body_text">
        <a href="../../../_res/projects/default_project/_page_/001/004/139/giji12.pdf">
          12月定例会議事録 （PDF 931.4KB）
          <img src="../../../_template_/_site_/_default_/_res/images/parts/newwin1.gif" alt="新しいウィンドウで開きます">
        </a>
      </div>
    `;

    const result = parseMeetingPage(html, PAGE_URL);

    expect(result).not.toBeNull();
    expect(result!.pdfUrl).toBe(
      "https://www.town.hachirogata.akita.jp/_res/projects/default_project/_page_/001/004/139/giji12.pdf",
    );
    expect(result!.linkText).toContain("12月定例会議事録");
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<div class="body_text"><p>ページ準備中です</p></div>`;

    const result = parseMeetingPage(html, PAGE_URL);
    expect(result).toBeNull();
  });

  it("絶対パスの PDF リンクも処理する", () => {
    const html = `
      <a href="/_res/projects/default_project/_page_/001/004/139/giji12.pdf">
        12月定例会議事録 （PDF 931.4KB）
      </a>
    `;

    const result = parseMeetingPage(html, PAGE_URL);
    expect(result).not.toBeNull();
    expect(result!.pdfUrl).toBe(
      "https://www.town.hachirogata.akita.jp/_res/projects/default_project/_page_/001/004/139/giji12.pdf",
    );
  });
});
