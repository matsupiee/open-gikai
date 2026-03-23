import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseDateFromLink, parseYearFromHeading } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/town/gikai/kaigiroku/2060">令和４年 会議録</a></li>
        <li><a href="/town/gikai/kaigiroku/2063">令和５年 会議録</a></li>
        <li><a href="/town/gikai/kaigiroku/2911">令和６年 会議録</a></li>
        <li><a href="/town/gikai/kaigiroku/2917">令和７年 会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(4);
    expect(pages[0]!.label).toBe("令和４年 会議録");
    expect(pages[0]!.url).toBe("https://www.town.gojome.akita.jp/town/gikai/kaigiroku/2060");
    expect(pages[3]!.label).toBe("令和７年 会議録");
    expect(pages[3]!.url).toBe("https://www.town.gojome.akita.jp/town/gikai/kaigiroku/2917");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/town/gikai/kaigiroku/2917">令和７年 会議録</a>
      <a href="/town/gikai/about">議会について</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和７年 会議録");
  });
});

describe("parseDateFromLink", () => {
  it("半角括弧・半角数字の日付を抽出する", () => {
    expect(parseDateFromLink("第1号  (12月8日)")).toEqual({ month: 12, day: 8 });
  });

  it("全角括弧・全角数字の日付を抽出する", () => {
    expect(parseDateFromLink("第３回臨時会（１２月２６日）")).toEqual({ month: 12, day: 26 });
  });

  it("混在パターンを抽出する", () => {
    expect(parseDateFromLink("第１回臨時会　(1月27日)")).toEqual({ month: 1, day: 27 });
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromLink("第4回定例会 会期日程")).toBeNull();
  });
});

describe("parseYearFromHeading", () => {
  it("令和の全角数字から西暦を抽出する", () => {
    expect(parseYearFromHeading("令和７年第４回定例会")).toBe(2025);
  });

  it("令和の半角数字から西暦を抽出する", () => {
    expect(parseYearFromHeading("令和7年第4回定例会")).toBe(2025);
  });

  it("令和元年に対応する", () => {
    expect(parseYearFromHeading("令和元年第1回定例会")).toBe(2019);
  });

  it("平成に対応する", () => {
    expect(parseYearFromHeading("平成３１年第1回定例会")).toBe(2019);
  });

  it("年度が見つからない場合は null を返す", () => {
    expect(parseYearFromHeading("一般質問順序")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL = "https://www.town.gojome.akita.jp/town/gikai/kaigiroku/2917";

  it("h3 見出し配下の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和７年第３回臨時会</h3>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/rinji3.pdf">第３回臨時会  (12月26日)</a></li>
      </ul>
      <h3>令和７年第４回定例会 (１２月定例会)</h3>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/hitei.pdf">第4回定例会 会期日程</a></li>
        <li><a href="/up/files/town/gikai/kaigiroku/1.pdf">第4回定例会 第1号  (12月8日)</a></li>
        <li><a href="/up/files/town/gikai/kaigiroku/2.pdf">第4回定例会 第2号  (12月9日)</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.section).toBe("令和７年第３回臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-12-26");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gojome.akita.jp/up/files/town/gikai/kaigiroku/rinji3.pdf"
    );

    expect(meetings[1]!.section).toBe("令和７年第４回定例会 (１２月定例会)");
    expect(meetings[1]!.heldOn).toBe("2025-12-08");
    expect(meetings[1]!.title).toBe("令和７年第４回定例会 (１２月定例会) 第4回定例会 第1号  (12月8日)");

    expect(meetings[2]!.section).toBe("令和７年第４回定例会 (１２月定例会)");
    expect(meetings[2]!.heldOn).toBe("2025-12-09");
  });

  it("会期日程 PDF はスキップする", () => {
    const html = `
      <h3>令和７年第１回定例会 (３月定例会)</h3>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/hitei.pdf">第1回定例会 会期日程</a></li>
        <li><a href="/up/files/town/gikai/kaigiroku/1.pdf">第1回定例会 第1号（3月10日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-10");
  });

  it("一般質問の議員別 PDF を抽出する", () => {
    const html = `
      <h3>令和７年第２回定例会 (６月定例会)</h3>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/2.pdf">第2回定例会 第2号（6月10日）</a></li>
      </ul>
      <p>一般質問順序 各議員別（6月10日一般質問）</p>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/01_sazawayukako.pdf">1.佐沢由佳子議員（6月10日）</a></li>
        <li><a href="/up/files/town/gikai/kaigiroku/02_isikawasigemitu.pdf">2.石川重光議員（6月10日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(3);
    expect(meetings[1]!.title).toContain("佐沢由佳子議員");
    expect(meetings[1]!.heldOn).toBe("2025-06-10");
  });

  it("日付のないリンクはスキップする", () => {
    const html = `
      <h3>令和７年第１回定例会</h3>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/1.pdf">1.松浦真議員</a></li>
        <li><a href="/up/files/town/gikai/kaigiroku/2.pdf">第1回定例会 第1号（3月10日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-10");
  });

  it("議事日程 PDF もスキップする", () => {
    const html = `
      <h3>令和７年第１回定例会</h3>
      <ul>
        <li><a href="/up/files/town/gikai/kaigiroku/nittei.pdf">12月定例会議事日程（12月8日）</a></li>
        <li><a href="/up/files/town/gikai/kaigiroku/1.pdf">第1回定例会 第1号（3月10日）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });
});
