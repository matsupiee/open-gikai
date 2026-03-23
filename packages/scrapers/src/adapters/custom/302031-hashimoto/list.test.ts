import { describe, it, expect } from "vitest";
import {
  parseYearIndexPage,
  parseMeetingPage,
  parseDateText,
  parseBackNumberPage,
} from "./list";

describe("parseYearIndexPage", () => {
  it("年度一覧ページから会議ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/20430.html">令和7年2月臨時会会議録</a></li>
        <li><a href="https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/20632.html">令和7年3月定例会会議録</a></li>
        <li><a href="https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/20431.html">令和7年6月定例会会議録</a></li>
      </ul>
    `;

    const pages = parseYearIndexPage(
      html,
      "https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/index.html"
    );

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年2月臨時会会議録");
    expect(pages[0]!.url).toBe(
      "https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/20430.html"
    );
    expect(pages[1]!.label).toBe("令和7年3月定例会会議録");
    expect(pages[2]!.label).toBe("令和7年6月定例会会議録");
  });

  it("定例会・臨時会を含まないリンクはスキップする", () => {
    const html = `
      <a href="https://example.com/other.html">お知らせ</a>
      <a href="https://example.com/20632.html">令和7年3月定例会会議録</a>
    `;

    const pages = parseYearIndexPage(html, "https://example.com/index.html");
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年3月定例会会議録");
  });

  it("会議録を含まない定例会リンクはスキップする", () => {
    const html = `
      <a href="https://example.com/schedule.html">令和7年3月定例会日程</a>
      <a href="https://example.com/20632.html">令和7年3月定例会会議録</a>
    `;

    const pages = parseYearIndexPage(html, "https://example.com/index.html");
    expect(pages).toHaveLength(1);
  });

  it("protocol-relative URL に対応する", () => {
    const html = `
      <a href="//www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/20632.html">令和7年3月定例会会議録</a>
    `;

    const pages = parseYearIndexPage(html, "https://example.com/index.html");
    expect(pages[0]!.url).toBe(
      "https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/R7kaigiroku/20632.html"
    );
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("令和7年2月25日　会議録 (PDFファイル: 274.8KB)")).toBe(
      "2025-02-25"
    );
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成30年3月5日　会議録")).toBe("2018-03-05");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月10日　会議録")).toBe("2019-06-10");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年4月1日　会議録")).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("目次 (PDFファイル: 172.5KB)")).toBeNull();
  });
});

describe("parseMeetingPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <h1>令和7年3月定例会会議録</h1>
      <h2>第1日(2月25日)</h2>
      <a href="//www.city.hashimoto.lg.jp/material/files/group/27/2025-0225.pdf">
        令和7年2月25日　会議録 (PDFファイル: 274.8KB)
      </a>
      <h2>第2日(3月3日)</h2>
      <a href="//www.city.hashimoto.lg.jp/material/files/group/27/2025-0303.pdf">
        令和7年3月3日　会議録 (PDFファイル: 721.5KB)
      </a>
    `;

    const meetings = parseMeetingPage(html, "令和7年3月定例会");

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.hashimoto.lg.jp/material/files/group/27/2025-0225.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2025-02-25");
    expect(meetings[0]!.title).toBe("令和7年3月定例会 令和7年2月25日　会議録");
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.hashimoto.lg.jp/material/files/group/27/2025-0303.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2025-03-03");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <a href="//www.city.hashimoto.lg.jp/material/files/group/27/R07-03mokuji.pdf">
        目次 (PDFファイル: 172.5KB)
      </a>
      <a href="//www.city.hashimoto.lg.jp/material/files/group/27/2025-0225.pdf">
        令和7年2月25日　会議録 (PDFファイル: 274.8KB)
      </a>
    `;

    const meetings = parseMeetingPage(html, "令和7年3月定例会");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-02-25");
  });

  it("臨時会のタイプを正しく検出する", () => {
    const html = `
      <a href="//example.com/material/files/group/27/202502062gaturinnjikai.pdf">
        令和7年2月6日　会議録 (PDFファイル: 130.8KB)
      </a>
    `;

    const meetings = parseMeetingPage(html, "令和7年2月臨時会");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <a href="//example.com/material/files/group/27/somedata.pdf">
        資料一覧 (PDFファイル: 50KB)
      </a>
    `;

    const meetings = parseMeetingPage(html, "令和7年3月定例会");
    expect(meetings).toHaveLength(0);
  });

  it("絶対パス URL に対応する", () => {
    const html = `
      <a href="/material/files/group/27/2025-0225.pdf">
        令和7年2月25日　会議録 (PDFファイル: 274.8KB)
      </a>
    `;

    const meetings = parseMeetingPage(html, "令和7年3月定例会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.hashimoto.lg.jp/material/files/group/27/2025-0225.pdf"
    );
  });
});

describe("parseBackNumberPage", () => {
  it("バックナンバーページから会議リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/back_number/1359697078064.html">平成22年12月定例会</a></li>
        <li><a href="https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/back_number/kaigiroku201009.html">平成22年9月定例会</a></li>
      </ul>
    `;

    const pages = parseBackNumberPage(html);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.label).toBe("平成22年12月定例会");
    expect(pages[0]!.url).toBe(
      "https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/back_number/1359697078064.html"
    );
    expect(pages[1]!.label).toBe("平成22年9月定例会");
  });

  it("定例会・臨時会を含まないリンクはスキップする", () => {
    const html = `
      <a href="https://example.com/back_number/info.html">お知らせ</a>
      <a href="https://example.com/back_number/1359697078064.html">平成22年12月定例会</a>
    `;

    const pages = parseBackNumberPage(html);
    expect(pages).toHaveLength(1);
  });
});
