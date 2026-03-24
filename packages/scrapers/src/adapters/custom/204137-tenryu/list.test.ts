import { describe, it, expect } from "vitest";
import {
  isActivityRecord,
  parseTitleDate,
  parseListPage,
  parseDetailPage,
  buildHeldOn,
  filterByYear,
} from "./list";

describe("isActivityRecord", () => {
  it("議会活動記録を含むテキストは true を返す", () => {
    expect(isActivityRecord("令和７年２月天龍村議会活動記録")).toBe(true);
    expect(isActivityRecord("令和８年１月天龍村議会活動記録")).toBe(true);
  });

  it("定例議会は false を返す", () => {
    expect(isActivityRecord("令和８年３月　第１回定例議会")).toBe(false);
  });

  it("臨時議会は false を返す", () => {
    expect(isActivityRecord("令和７年８月　第２回臨時議会")).toBe(false);
  });

  it("議会だよりは false を返す", () => {
    expect(isActivityRecord("令和８年１月天龍村議会だより")).toBe(false);
  });
});

describe("parseTitleDate", () => {
  it("令和７年２月を解析する", () => {
    const result = parseTitleDate("令和７年２月天龍村議会活動記録");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.month).toBe(2);
  });

  it("令和８年１月を解析する", () => {
    const result = parseTitleDate("令和８年１月天龍村議会活動記録");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.month).toBe(1);
  });

  it("令和５年７月を解析する", () => {
    const result = parseTitleDate("令和５年７月天龍村議会活動記録");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.month).toBe(7);
  });

  it("半角数字でも解析する", () => {
    const result = parseTitleDate("令和7年2月天龍村議会活動記録");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.month).toBe(2);
  });

  it("令和元年に対応する", () => {
    const result = parseTitleDate("令和元年9月天龍村議会活動記録");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.month).toBe(9);
  });

  it("年月がない場合は null を返す", () => {
    expect(parseTitleDate("天龍村議会だより")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("議会活動記録リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/notice/administrative/%e4%bb%a4%e5%92%8c%ef%bc%97%e5%b9%b4%ef%bc%92%e6%9c%88/">令和７年２月天龍村議会活動記録</a></li>
        <li><a href="/notice/administrative/%e4%bb%a4%e5%92%8c%ef%bc%97%e5%b9%b4%ef%bc%91%e6%9c%88/">令和７年１月天龍村議会活動記録</a></li>
        <li><a href="/notice/administrative/teireigikai/">令和８年３月　第１回定例議会</a></li>
        <li><a href="/notice/administrative/dayori/">令和８年１月天龍村議会だより</a></li>
      </ul>
    `;
    const links = parseListPage(html);
    expect(links).toHaveLength(2);
    expect(links[0]!.title).toBe("令和７年２月天龍村議会活動記録");
    expect(links[0]!.articleUrl).toContain("https://www.vill-tenryu.jp");
    expect(links[1]!.title).toBe("令和７年１月天龍村議会活動記録");
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <a href="https://www.vill-tenryu.jp/notice/administrative/abc/">令和７年２月天龍村議会活動記録</a>
    `;
    const links = parseListPage(html);
    expect(links[0]!.articleUrl).toBe("https://www.vill-tenryu.jp/notice/administrative/abc/");
  });

  it("議会活動記録がない場合は空配列を返す", () => {
    const html = `
      <a href="/teireigikai/">令和８年３月　第１回定例議会</a>
      <a href="/dayori/">令和８年１月天龍村議会だより</a>
    `;
    const links = parseListPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseDetailPage", () => {
  it("wp-content/uploads の PDF リンクを抽出する", () => {
    const html = `
      <div class="entry-content">
        <a href="/wp-content/uploads/2025/02/abc123def456.pdf">令和７年２月天龍村議会活動記録（PDF）</a>
      </div>
    `;
    const pdfUrl = parseDetailPage(html);
    expect(pdfUrl).toBe("https://www.vill-tenryu.jp/wp-content/uploads/2025/02/abc123def456.pdf");
  });

  it("絶対 URL の PDF リンクはそのまま返す", () => {
    const html = `
      <a href="https://www.vill-tenryu.jp/wp-content/uploads/2025/02/xyz789.pdf">PDF ダウンロード</a>
    `;
    const pdfUrl = parseDetailPage(html);
    expect(pdfUrl).toBe("https://www.vill-tenryu.jp/wp-content/uploads/2025/02/xyz789.pdf");
  });

  it("PDF リンクがない場合は null を返す", () => {
    const html = `<div><p>議会開催案内</p></div>`;
    const pdfUrl = parseDetailPage(html);
    expect(pdfUrl).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("YYYY-MM-01 形式を生成する", () => {
    expect(buildHeldOn(2025, 2)).toBe("2025-02-01");
    expect(buildHeldOn(2026, 1)).toBe("2026-01-01");
    expect(buildHeldOn(2023, 7)).toBe("2023-07-01");
    expect(buildHeldOn(2023, 10)).toBe("2023-10-01");
  });
});

describe("filterByYear", () => {
  it("指定年のアイテムのみ返す", () => {
    const items = [
      { pdfUrl: "a.pdf", title: "A", heldOn: "2025-02-01", sourceUrl: "https://example.com/a" },
      { pdfUrl: "b.pdf", title: "B", heldOn: "2024-10-01", sourceUrl: "https://example.com/b" },
      { pdfUrl: "c.pdf", title: "C", heldOn: "2025-01-01", sourceUrl: "https://example.com/c" },
    ];

    const result = filterByYear(items, 2025);
    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("A");
    expect(result[1]!.title).toBe("C");
  });

  it("一致するアイテムがない場合は空配列を返す", () => {
    const items = [
      { pdfUrl: "a.pdf", title: "A", heldOn: "2025-02-01", sourceUrl: "https://example.com/a" },
    ];
    expect(filterByYear(items, 2024)).toHaveLength(0);
  });
});
