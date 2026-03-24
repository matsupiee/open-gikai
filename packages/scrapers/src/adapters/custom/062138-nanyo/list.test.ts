import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseDateFromFilename,
} from "./list";

describe("parseDateFromFilename", () => {
  it("令和7年12月定例会 PDF ファイル名から日付を抽出する", () => {
    expect(
      parseDateFromFilename("南陽市議会令和7年12月定例会.pdf")
    ).toBe("2025-12-01");
  });

  it("令和6年3月定例会 PDF ファイル名から日付を抽出する", () => {
    expect(
      parseDateFromFilename("南陽市議会令和6年3月定例会.pdf")
    ).toBe("2024-03-01");
  });

  it("令和元年 PDF ファイル名から日付を抽出する", () => {
    expect(
      parseDateFromFilename("南陽市議会令和元年9月定例会.pdf")
    ).toBe("2019-09-01");
  });

  it("平成21年 PDF ファイル名から日付を抽出する", () => {
    expect(
      parseDateFromFilename("平成21年3月定例会.pdf")
    ).toBe("2009-03-01");
  });

  it("日付情報のないファイル名は null を返す", () => {
    expect(parseDateFromFilename("419.pdf")).toBeNull();
    expect(parseDateFromFilename("発議第３号.pdf")).toBeNull();
  });
});

const TOP_PAGE_HTML = `
<div class="section-body">
  <ul>
    <li><a href="/gikaikaigiroku/5903">令和7年会議録</a></li>
    <li><a href="/gikaikaigiroku/5461">令和6年会議録</a></li>
    <li><a href="/gikaikaigiroku/4972">令和5年会議録</a></li>
    <li><a href="/gikaikaigiroku/215">平成21年会議録</a></li>
  </ul>
</div>
`;

describe("parseTopPage", () => {
  it("年度別ページ URL と年を抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);

    expect(result.length).toBe(4);
    expect(result[0]!.url).toBe(
      "http://www.city.nanyo.yamagata.jp/gikaikaigiroku/5903"
    );
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.url).toBe(
      "http://www.city.nanyo.yamagata.jp/gikaikaigiroku/5461"
    );
    expect(result[1]!.year).toBe(2024);
  });

  it("令和元年を正しく変換する", () => {
    const html = `<a href="/gikaikaigiroku/1000">令和元年会議録</a>`;
    const result = parseTopPage(html);
    expect(result[0]!.year).toBe(2019);
  });

  it("平成年のリンクを抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const heisei = result.find((r) => r.year === 2009);
    expect(heisei).toBeDefined();
    expect(heisei!.url).toBe(
      "http://www.city.nanyo.yamagata.jp/gikaikaigiroku/215"
    );
  });

  it("会議録以外のリンクはスキップする", () => {
    const html = `
      <a href="/other/page">その他のページ</a>
      <a href="/gikaikaigiroku/5903">令和7年会議録</a>
    `;
    const result = parseTopPage(html);
    expect(result.length).toBe(1);
  });

  it("重複する URL はスキップする", () => {
    const html = `
      <a href="/gikaikaigiroku/5903">令和7年会議録</a>
      <a href="/gikaikaigiroku/5903">令和7年会議録（再掲）</a>
    `;
    const result = parseTopPage(html);
    expect(result.length).toBe(1);
  });
});

const YEAR_PAGE_HTML = `
<div>
  <p>
    <a href="/up/files/giyousei/sigikai/gikaikaigiroku/%E5%8D%97%E9%99%BD%E5%B8%82%E8%AD%B0%E4%BC%9A%E4%BB%A4%E5%92%8C7%E5%B9%B412%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf">12月定例会会議録</a>
    <small>（36MB）</small>
  </p>
  <p>
    <a href="/up/files/giyousei/sigikai/gikaikaigiroku/419.pdf">3月定例会会議録</a>
  </p>
  <p>
    <a href="/other/files/document.pdf">その他の文書</a>
  </p>
</div>
`;

describe("parseYearPage", () => {
  it("PDF リンクを抽出する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);

    expect(result.length).toBe(2);
    expect(result[0]!.pdfUrl).toBe(
      "http://www.city.nanyo.yamagata.jp/up/files/giyousei/sigikai/gikaikaigiroku/%E5%8D%97%E9%99%BD%E5%B8%82%E8%AD%B0%E4%BC%9A%E4%BB%A4%E5%92%8C7%E5%B9%B412%E6%9C%88%E5%AE%9A%E4%BE%8B%E4%BC%9A.pdf"
    );
    expect(result[0]!.title).toBe("12月定例会会議録");
    expect(result[0]!.sessionName).toBe("12月定例会会議録");
  });

  it("日本語ファイル名から heldOn を解析する", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    // 12月定例会会議録 → 2025-12-01
    expect(result[0]!.heldOn).toBe("2025-12-01");
  });

  it("日付情報のないファイル名の heldOn は null", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    // 419.pdf → null
    expect(result[1]!.heldOn).toBeNull();
  });

  it("PDF パス外のリンクはスキップする", () => {
    const result = parseYearPage(YEAR_PAGE_HTML);
    // /other/files/document.pdf はスキップされる
    expect(result.length).toBe(2);
  });

  it("重複する PDF URL はスキップする", () => {
    const html = `
      <a href="/up/files/giyousei/sigikai/gikaikaigiroku/419.pdf">3月定例会（1）</a>
      <a href="/up/files/giyousei/sigikai/gikaikaigiroku/419.pdf">3月定例会（2）</a>
    `;
    const result = parseYearPage(html);
    expect(result.length).toBe(1);
  });
});
