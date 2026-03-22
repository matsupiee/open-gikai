import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseDateText } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul class="category_end">
        <li><a href="/0000008934.html">令和7年会議録</a><span class="date">&nbsp;[2026年2月24日]</span></li>
        <li><a href="/0000008445.html">令和6年会議録</a><span class="date">&nbsp;[2025年3月10日]</span></li>
        <li><a href="/0000007818.html">令和5年会議録</a><span class="date">&nbsp;[2024年3月15日]</span></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年会議録");
    expect(pages[0]!.url).toBe("https://www.city.mobara.chiba.jp/0000008934.html");
    expect(pages[1]!.label).toBe("令和6年会議録");
    expect(pages[2]!.label).toBe("令和5年会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/0000001234.html">お知らせ</a>
      <a href="/0000008934.html">令和7年会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年会議録");
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("第1号　令和7年11月26日　（PDF形式、534.27KB）")).toBe("2025-11-26");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("第1回　平成20年3月5日　（PDF形式、100KB）")).toBe("2008-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("資料一覧")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL = "https://www.city.mobara.chiba.jp/0000008934.html";

  it("セクション見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <p class="mol_attachfileblock_title">12月定例会　会議録</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000008/8934/25.11.26.pdf">第1号　令和7年11月26日　（PDF形式、534.27KB）</a></li>
        <li><a href="./cmsfiles/contents/0000008/8934/25.12.03.pdf">第2号　令和7年12月3日　（PDF形式、600KB）</a></li>
      </ul>
      <p class="mol_attachfileblock_title">9月定例会　会議録</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000008/8934/25.09.01.pdf">第1号　令和7年9月1日　（PDF形式、400KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.section).toBe("12月定例会");
    expect(meetings[0]!.heldOn).toBe("2025-11-26");
    expect(meetings[0]!.title).toBe("12月定例会 第1号　令和7年11月26日");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.mobara.chiba.jp/cmsfiles/contents/0000008/8934/25.11.26.pdf"
    );

    expect(meetings[1]!.section).toBe("12月定例会");
    expect(meetings[1]!.heldOn).toBe("2025-12-03");

    expect(meetings[2]!.section).toBe("9月定例会");
    expect(meetings[2]!.heldOn).toBe("2025-09-01");
  });

  it("臨時会セクションも正しく抽出する", () => {
    const html = `
      <p class="mol_attachfileblock_title">5月臨時会　会議録</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000008/8934/25.05.15.pdf">第1号　令和7年5月15日　（PDF形式、300KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("5月臨時会");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <p class="mol_attachfileblock_title">12月定例会　会議録</p>
      <ul>
        <li><a href="./cmsfiles/contents/0000008/8934/25.11.26.pdf">第1号　令和7年11月26日　（PDF形式、534.27KB）</a></li>
        <li><a href="./cmsfiles/some-doc.pdf">資料一覧</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });

  it("h2 見出しからもセクションを検出する", () => {
    const html = `
      <h2>3月定例会　会議録</h2>
      <ul>
        <li><a href="./cmsfiles/contents/0000008/8934/25.02.20.pdf">第1号　令和7年2月20日　（PDF形式、500KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("3月定例会");
  });
});
