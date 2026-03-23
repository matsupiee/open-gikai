import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>2025年(令和7年)</h3>
      <h4>令和7年 第1回 定例会</h4>
      <p><a href="/files/upload/abc-123.pdf">令和7年 第1回 東白川村議会定例会会議録(目次)(PDF版:1.64MB)</a></p>
      <p><a href="/files/upload/def-456.pdf">令和7年 第1回 東白川村議会定例会会議録(第1号 令和7年3月4日)(PDF版:849KB)</a></p>
      <p><a href="/files/upload/ghi-789.pdf">令和7年 第1回 東白川村議会定例会会議録(第2号 令和7年3月5日)(PDF版:350KB)</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.higashishirakawa.gifu.jp/files/upload/def-456.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2025-03-04");
    expect(meetings[0]!.sessionType).toBe("定例会");
    expect(meetings[0]!.title).toBe(
      "令和7年 第1回 東白川村議会定例会会議録(第1号 令和7年3月4日)"
    );

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.vill.higashishirakawa.gifu.jp/files/upload/ghi-789.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2025-03-05");
  });

  it("臨時会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>2025年(令和7年)</h3>
      <h4>令和7年 第1回 臨時会</h4>
      <p><a href="/files/upload/aaa-111.pdf">令和7年 第1回 東白川村議会臨時会会議録(目次)(PDF版:448KB)</a></p>
      <p><a href="/files/upload/bbb-222.pdf">令和7年 第1回 東白川村議会臨時会会議録(令和7年1月15日)(PDF版:300KB)</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.sessionType).toBe("臨時会");
    expect(meetings[0]!.heldOn).toBe("2025-01-15");
  });

  it("目次 PDF を除外する", () => {
    const html = `
      <h4>令和7年 第1回 定例会</h4>
      <p><a href="/files/upload/toc.pdf">令和7年 第1回 東白川村議会定例会会議録(目次)(PDF版:1.64MB)</a></p>
      <p><a href="/files/upload/body.pdf">令和7年 第1回 東白川村議会定例会会議録(第1号 令和7年3月4日)(PDF版:849KB)</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).not.toContain("目次");
  });

  it("対象年でフィルタリングする", () => {
    const html = `
      <h3>2025年(令和7年)</h3>
      <h4>令和7年 第1回 定例会</h4>
      <p><a href="/files/upload/a.pdf">令和7年 第1回 東白川村議会定例会会議録(第1号 令和7年3月4日)(PDF版:849KB)</a></p>
      <h3>2024年(令和6年)</h3>
      <h4>令和6年 第4回 定例会</h4>
      <p><a href="/files/upload/b.pdf">令和6年 第4回 東白川村議会定例会会議録(第1号 令和6年12月10日)(PDF版:500KB)</a></p>
    `;

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(1);
    expect(meetings2025[0]!.heldOn).toBe("2025-03-04");

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(1);
    expect(meetings2024[0]!.heldOn).toBe("2024-12-10");
  });

  it("平成の日付にも対応する", () => {
    const html = `
      <h4>平成30年 第1回 定例会</h4>
      <p><a href="/files/upload/old.pdf">平成30年 第1回 東白川村議会定例会会議録(第1号 平成30年3月6日)(PDF版:400KB)</a></p>
    `;

    const meetings = parseListPage(html, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-03-06");
  });

  it("令和元年に対応する", () => {
    const html = `
      <h4>令和元年 第2回 定例会</h4>
      <p><a href="/files/upload/reiwa1.pdf">令和元年 第2回 東白川村議会定例会会議録(第1号 令和元年6月11日)(PDF版:500KB)</a></p>
    `;

    const meetings = parseListPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-11");
  });

  it("PDF リンク以外のリンクは無視する", () => {
    const html = `
      <h4>令和7年 第1回 定例会</h4>
      <p><a href="/sonsei/gikai/other-page.html">議事日程</a></p>
      <p><a href="/files/upload/body.pdf">令和7年 第1回 東白川村議会定例会会議録(第1号 令和7年3月4日)(PDF版:849KB)</a></p>
    `;

    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("", 2025)).toEqual([]);
  });
});
