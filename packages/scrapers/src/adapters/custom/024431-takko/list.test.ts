import { describe, expect, it } from "vitest";
import { parseIndexPage, parseYearPage } from "./list";

describe("parseIndexPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <div id="page_body">
        <h1>議事録</h1>
        <ul>
          <li><a href="/index.cfm/13,13166,45,190,html">議案審議結果一覧（令和8年分）</a></li>
          <li><a href="/index.cfm/13,11939,45,190,html">議案審議結果一覧（令和7年分）</a></li>
          <li><a href="/index.cfm/13,10401,45,190,html">議案審議結果一覧（令和6年分）</a></li>
          <li><a href="/index.cfm/13,9700,45,190,html">議案審議結果一覧（令和5年分）</a></li>
        </ul>
      </div>
    `;

    const pages = parseIndexPage(html);

    expect(pages).toHaveLength(4);
    expect(pages[0]!.label).toBe("議案審議結果一覧（令和8年分）");
    expect(pages[0]!.url).toBe(
      "https://www.town.takko.lg.jp/index.cfm/13,13166,45,190,html"
    );
    expect(pages[1]!.label).toBe("議案審議結果一覧（令和7年分）");
    expect(pages[1]!.url).toBe(
      "https://www.town.takko.lg.jp/index.cfm/13,11939,45,190,html"
    );
  });

  it("「議案審議結果一覧」を含まないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/index.cfm/13,13166,45,190,html">議案審議結果一覧（令和8年分）</a></li>
        <li><a href="/index.cfm/13,9999,45,190,html">議会だより</a></li>
        <li><a href="/index.cfm/13,8888,45,190,html">その他リンク</a></li>
      </ul>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("議案審議結果一覧（令和8年分）");
  });

  it("重複したリンクは除外する", () => {
    const html = `
      <ul>
        <li><a href="/index.cfm/13,13166,45,190,html">議案審議結果一覧（令和8年分）</a></li>
        <li><a href="/index.cfm/13,13166,45,190,html">議案審議結果一覧（令和8年分）</a></li>
      </ul>
    `;

    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>内容なし</p></div>`;
    const pages = parseIndexPage(html);
    expect(pages).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会と臨時会の PDF リンクを抽出する", () => {
    const html = `
      <div id="page_body">
        <h3>〇定例会</h3>
        <ul>
          <li><a href="/_resources/content/11939/20250317-141754.pdf"><img alt="" src="/images/icons/pdf.gif">第１回定例会</a></li>
          <li><a href="/_resources/content/11939/20250620-100000.pdf"><img alt="" src="/images/icons/pdf.gif">第２回定例会</a></li>
        </ul>
        <h3>〇臨時会</h3>
        <ul>
          <li><a href="/_resources/content/11939/20250110-090000.pdf"><img alt="" src="/images/icons/pdf.gif">第１回臨時会</a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html, 2025);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.title).toBe("第１回定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.takko.lg.jp/_resources/content/11939/20250317-141754.pdf"
    );
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.meetingSection).toBe("〇定例会");

    expect(meetings[1]!.title).toBe("第２回定例会");

    expect(meetings[2]!.title).toBe("第１回臨時会");
    expect(meetings[2]!.meetingSection).toBe("〇臨時会");
  });

  it("PDF リンクがないセクションはスキップする", () => {
    const html = `
      <div id="page_body">
        <h3>〇定例会</h3>
        <ul>
          <li>準備中</li>
        </ul>
        <h3>〇臨時会</h3>
        <ul>
          <li><a href="/_resources/content/11939/20250110-090000.pdf">第１回臨時会</a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第１回臨時会");
  });

  it("定例会・臨時会以外のセクションはスキップする", () => {
    const html = `
      <div id="page_body">
        <h3>議会だより</h3>
        <ul>
          <li><a href="/_resources/content/11939/20250101-000000.pdf">議会だより</a></li>
        </ul>
        <h3>〇定例会</h3>
        <ul>
          <li><a href="/_resources/content/11939/20250317-141754.pdf">第１回定例会</a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第１回定例会");
  });

  it("URL 末尾の全角スペースをトリムする", () => {
    const html = `
      <div id="page_body">
        <h3>〇定例会</h3>
        <ul>
          <li><a href="/_resources/content/11939/20250317-141754.pdf　">第１回定例会</a></li>
        </ul>
      </div>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.takko.lg.jp/_resources/content/11939/20250317-141754.pdf"
    );
  });

  it("PDFリンクのないページは空配列を返す", () => {
    const html = `<div id="page_body"><p>内容なし</p></div>`;
    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });
});
