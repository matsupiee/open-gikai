import { describe, expect, it } from "vitest";
import { parseListPage, parseSessionInfo } from "./list";

describe("parseSessionInfo", () => {
  it("定例会を解析する", () => {
    const result = parseSessionInfo("第1回定例会議事録");
    expect(result).not.toBeNull();
    expect(result!.sessionType).toBe("定例会");
    expect(result!.sessionNumber).toBe("第1回");
  });

  it("臨時会を解析する", () => {
    const result = parseSessionInfo("第2回臨時会議事録");
    expect(result).not.toBeNull();
    expect(result!.sessionType).toBe("臨時会");
    expect(result!.sessionNumber).toBe("第2回");
  });

  it("回次が 2 桁の場合を解析する", () => {
    const result = parseSessionInfo("第10回定例会議事録");
    expect(result).not.toBeNull();
    expect(result!.sessionNumber).toBe("第10回");
  });

  it("定例会・臨時会どちらも含まない場合は null を返す", () => {
    const result = parseSessionInfo("第1回議案書");
    expect(result).toBeNull();
  });

  it("回次が含まれない場合は null を返す", () => {
    const result = parseSessionInfo("定例会議事録");
    expect(result).toBeNull();
  });
});

describe("parseListPage", () => {
  it("指定年の議事録 PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="/fs/2/7/1/6/9/1/_/___1___.pdf">第1回臨時会議事録</a></p>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.toshimamura.org/fs/2/7/1/6/9/1/_/___1___.pdf"
    );
    expect(meetings[0]!.title).toBe("第1回臨時会議事録");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.sessionType).toBe("臨時会");
    expect(meetings[0]!.sessionNumber).toBe("第1回");
    expect(meetings[1]!.sessionType).toBe("定例会");
  });

  it("指定年以外のリンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="/fs/2/7/1/6/9/1/_/___1___.pdf">第1回臨時会議事録</a></p>
        <h3>2024年（令和6年）</h3>
        <p><a href="/fs/2/3/4/6/3/9/_/__6__1________.pdf">第1回定例議会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2025);
  });

  it("議事録以外のリンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="/fs/1/2/3/4/5/6/_/gian.pdf">第1回定例会議案書</a></p>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第1回定例会議事録");
  });

  it("/fs/ を含まない PDF リンクはスキップする", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="/other/file.pdf">第1回定例会議事録</a></p>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("/fs/");
  });

  it("同じ URL の重複を除外する", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
  });

  it("h3 の前にあるリンクはスキップする（年度不明）", () => {
    const html = `
      <html>
      <body>
        <p><a href="/fs/9/9/9/9/9/9/_/unknown.pdf">議事録</a></p>
        <h3>2025年（令和7年）</h3>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("2/8/6/3/4/5");
  });

  it("リンクが 0 件の場合は空配列を返す", () => {
    const html = `<html><body><h3>2025年（令和7年）</h3><p>なし</p></body></html>`;
    const meetings = parseListPage(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL がそのまま使われる", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="https://www.toshimamura.org/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.toshimamura.org/fs/2/8/6/3/4/5/_/__1___.pdf"
    );
  });

  it("複数年度が混在する HTML から指定年のみ取得する", () => {
    const html = `
      <html>
      <body>
        <h3>2025年（令和7年）</h3>
        <p><a href="/fs/2/7/1/6/9/1/_/___1___.pdf">第1回臨時会議事録</a></p>
        <p><a href="/fs/2/8/6/3/4/5/_/__1___.pdf">第1回定例会議事録</a></p>
        <h3>2024年（令和6年）</h3>
        <p><a href="/fs/2/3/4/6/3/9/_/__6__1________.pdf">第1回定例議会議事録</a></p>
        <p><a href="/fs/2/4/9/0/2/6/_/R6.6__2___.pdf">第2回定例議会議事録</a></p>
        <h3>2023年（令和5年）</h3>
        <p><a href="/fs/1/6/6/9/5/6/_/R5.1______.pdf">第1回定例会議事録</a></p>
      </body>
      </html>
    `;

    const meetings2025 = parseListPage(html, 2025);
    expect(meetings2025).toHaveLength(2);
    expect(meetings2025.every((m) => m.year === 2025)).toBe(true);

    const meetings2024 = parseListPage(html, 2024);
    expect(meetings2024).toHaveLength(2);
    expect(meetings2024.every((m) => m.year === 2024)).toBe(true);
  });
});
