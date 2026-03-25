import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseDateFromLinkText,
  extractYearFromLabel,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chousei/chousei/kaigiroku/gikai20250206.html">令和6年会議録</a></li>
        <li><a href="/chousei/chousei/kaigiroku/gikai20240329.html">令和5年会議録</a></li>
        <li><a href="/chousei/chousei/kaigiroku/gikai2022kaigiroku.html">令和4年会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(
      html,
      "https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/index.html"
    );

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和6年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/gikai20250206.html"
    );
    expect(pages[1]!.label).toBe("令和5年会議録");
    expect(pages[2]!.label).toBe("令和4年会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/some/page.html">お知らせ</a>
      <a href="/chousei/chousei/kaigiroku/gikai20250206.html">令和6年会議録</a>
    `;

    const pages = parseTopPage(
      html,
      "https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/index.html"
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和6年会議録");
  });

  it("平成31年・令和元年の複合ラベルを含むリンクを抽出する", () => {
    const html = `
      <a href="/chousei/chousei/kaigiroku/heisei31reiwa1.html">平成31年・令和元年会議録</a>
    `;

    const pages = parseTopPage(
      html,
      "https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/index.html"
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("平成31年・令和元年会議録");
  });
});

describe("parseDateFromLinkText", () => {
  it("定例会（月のみ）から日付を生成する", () => {
    expect(parseDateFromLinkText("第1回定例会（3月）会議録", 2024)).toBe(
      "2024-03-01"
    );
  });

  it("定例会（12月）から日付を生成する", () => {
    expect(parseDateFromLinkText("第4回定例会（12月）会議録", 2024)).toBe(
      "2024-12-01"
    );
  });

  it("臨時会（月日）から日付を生成する", () => {
    expect(
      parseDateFromLinkText("第1回臨時会（1月25日）会議録", 2024)
    ).toBe("2024-01-25");
  });

  it("臨時会（11月8日）から日付を生成する", () => {
    expect(
      parseDateFromLinkText("第3回臨時会（11月8日）会議録", 2024)
    ).toBe("2024-11-08");
  });

  it("日付パターンがない場合は null を返す", () => {
    expect(parseDateFromLinkText("会議録", 2024)).toBeNull();
  });

  it("1桁の月をゼロ埋めする", () => {
    expect(parseDateFromLinkText("第2回定例会（6月）会議録", 2024)).toBe(
      "2024-06-01"
    );
  });
});

describe("extractYearFromLabel", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromLabel("令和6年会議録")).toBe(2024);
  });

  it("令和元年を処理する", () => {
    expect(extractYearFromLabel("令和元年会議録")).toBe(2019);
  });

  it("平成31年・令和元年の複合ラベルを令和元年（2019）として処理する", () => {
    expect(extractYearFromLabel("平成31年・令和元年会議録")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromLabel("平成30年会議録")).toBe(2018);
  });

  it("年号がない場合は null を返す", () => {
    expect(extractYearFromLabel("会議録")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/gikai20250206.html";

  it("定例会と臨時会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>定例会</h3>
      <p><a href="gikai20250206.files/R6.3.pdf">第1回定例会（3月）会議録（PDF：1,435KB）</a></p>
      <p><a href="gikai20250206.files/R6.6.pdf">第2回定例会（6月）会議録（PDF：1,001KB）</a></p>
      <h3>臨時会</h3>
      <p><a href="gikai20250206.files/R6.1.25.pdf">第1回臨時会（1月25日）会議録（PDF：373KB）</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.meetingSection).toBe("定例会");
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[0]!.title).toBe("第1回定例会（3月）会議録");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/gikai20250206.files/R6.3.pdf"
    );

    expect(meetings[1]!.meetingSection).toBe("定例会");
    expect(meetings[1]!.heldOn).toBe("2024-06-01");
    expect(meetings[1]!.title).toBe("第2回定例会（6月）会議録");

    expect(meetings[2]!.meetingSection).toBe("臨時会");
    expect(meetings[2]!.heldOn).toBe("2024-01-25");
    expect(meetings[2]!.title).toBe("第1回臨時会（1月25日）会議録");
  });

  it("PDF ファイルサイズ注記をタイトルから除去する", () => {
    const html = `
      <h3>定例会</h3>
      <p><a href="gikai20250206.files/R6.9.pdf">第3回定例会（9月）会議録（PDF：1,308KB）</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);
    expect(meetings[0]!.title).toBe("第3回定例会（9月）会議録");
  });

  it("臨時会（11月8日）を正しくパースする", () => {
    const html = `
      <h3>臨時会</h3>
      <p><a href="gikai20250206.files/R6.11.8.pdf">第3回臨時会（11月8日）会議録（PDF：490KB）</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);
    expect(meetings[0]!.heldOn).toBe("2024-11-08");
    expect(meetings[0]!.title).toBe("第3回臨時会（11月8日）会議録");
  });

  it("PDF 以外のリンクはスキップする", () => {
    const html = `
      <h3>定例会</h3>
      <p><a href="/some/page.html">関連資料</a></p>
      <p><a href="gikai20250206.files/R6.3.pdf">第1回定例会（3月）会議録</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第1回定例会（3月）会議録");
  });
});
