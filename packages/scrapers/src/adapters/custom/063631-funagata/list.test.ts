import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseDateFromH3,
  extractYearFromLabel,
} from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する（span 内テキスト対応）", () => {
    const html = `
      <ul>
        <li><a href="../../../s027/gikai/010/160/20250328112359.html" class="link_text"><span class="inner">令和8年 議事録</span></a></li>
        <li><a href="../../../s027/gikai/010/150/20250328112359.html" class="link_text"><span class="inner">令和7年 議事録</span></a></li>
        <li><a href="../../../s027/gikai/010/140/20200104015000.html" class="link_text"><span class="inner">令和6年 議事録</span></a></li>
      </ul>
    `;

    const pages = parseTopPage(
      html,
      "https://www.town.funagata.yamagata.jp/li/gikai/010/"
    );

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和8年 議事録");
    expect(pages[0]!.url).toBe(
      "https://www.town.funagata.yamagata.jp/s027/gikai/010/160/20250328112359.html"
    );
    expect(pages[1]!.label).toBe("令和7年 議事録");
    expect(pages[2]!.label).toBe("令和6年 議事録");
  });

  it("議事録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/some/page.html"><span class="inner">お知らせ</span></a>
      <a href="../../../s027/gikai/010/150/20250328112359.html" class="link_text"><span class="inner">令和7年 議事録</span></a>
    `;

    const pages = parseTopPage(
      html,
      "https://www.town.funagata.yamagata.jp/li/gikai/010/"
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年 議事録");
  });
});

describe("parseDateFromH3", () => {
  it("単日の日付をパースする", () => {
    expect(parseDateFromH3("10月8日", 2025)).toBe("2025-10-08");
  });

  it("範囲の日付は最初の日付を使う", () => {
    expect(parseDateFromH3("12月3日から12月5日", 2025)).toBe("2025-12-03");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromH3("資料一覧", 2025)).toBeNull();
  });

  it("1桁の月日をゼロ埋めする", () => {
    expect(parseDateFromH3("3月5日", 2025)).toBe("2025-03-05");
  });
});

describe("extractYearFromLabel", () => {
  it("令和の年を西暦に変換する", () => {
    expect(extractYearFromLabel("令和7年 議事録")).toBe(2025);
  });

  it("令和元年を処理する", () => {
    expect(extractYearFromLabel("令和元年 議事録")).toBe(2019);
  });

  it("平成の年を西暦に変換する", () => {
    expect(extractYearFromLabel("平成30年 議事録")).toBe(2018);
  });

  it("年号がない場合は null を返す", () => {
    expect(extractYearFromLabel("議事録")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.funagata.yamagata.jp/s027/gikai/010/150/20250328112359.html";

  it("h2 セクションと PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>第4回 定例会</h2>
      <h3>12月3日から12月5日</h3>
      <p><a href="./r7-04teirei-12.3-12.5_2.pdf" title="令和7年第4回定例会">令和7年第4回定例会</a></p>
      <h2>第4回 臨時会</h2>
      <h3>10月8日</h3>
      <p><a href="./r07-dai4kairinjigikai1008.pdf" title="令和7年第4回臨時会">令和7年第4回臨時会</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2025);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.section).toBe("第4回 定例会");
    expect(meetings[0]!.heldOn).toBe("2025-12-03");
    expect(meetings[0]!.title).toBe("令和7年第4回定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.funagata.yamagata.jp/s027/gikai/010/150/r7-04teirei-12.3-12.5_2.pdf"
    );

    expect(meetings[1]!.section).toBe("第4回 臨時会");
    expect(meetings[1]!.heldOn).toBe("2025-10-08");
    expect(meetings[1]!.title).toBe("令和7年第4回臨時会");
  });

  it("定例会の複数セクション（定例会 + 委員会）を正しく抽出する", () => {
    const html = `
      <h2>第3回 定例会</h2>
      <h3>9月3日から9月9日</h3>
      <p><a href="./r07-03teirei-9.3-9.9.pdf" title="令和7年第3回定例会">令和7年第3回定例会</a></p>
      <h3>9月4日から9月8日</h3>
      <p><a href="./r07-kessan-9.4-9.8.pdf" title="令和7年9月決算審査特別委員会">令和7年9月決算審査特別委員会</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-09-03");
    expect(meetings[0]!.title).toBe("令和7年第3回定例会");
    expect(meetings[1]!.heldOn).toBe("2025-09-04");
    expect(meetings[1]!.title).toBe("令和7年9月決算審査特別委員会");
  });

  it("日付を含まない h3 の後の PDF リンクはスキップする", () => {
    const html = `
      <h2>第1回 定例会</h2>
      <h3>資料一覧</h3>
      <p><a href="./shiryou.pdf">資料</a></p>
      <h3>3月5日から3月12日</h3>
      <p><a href="./r07-01teirei-3.5-3.12.pdf" title="令和7年第1回定例会">令和7年第1回定例会</a></p>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
  });
});
