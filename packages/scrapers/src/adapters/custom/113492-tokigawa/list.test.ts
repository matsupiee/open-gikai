import { describe, it, expect } from "vitest";
import {
  parseMeetingTitle,
  parseIndexPage,
  extractHeldOnFromLinkText,
  buildFallbackTitle,
} from "./list";
import { buildIndexFileNames, indexFileNameToYear } from "./shared";

describe("buildIndexFileNames", () => {
  it("平成18年から令和7年のファイル名を生成する", () => {
    const names = buildIndexFileNames();
    expect(names).toContain("h18.html");
    expect(names).toContain("h31.html");
    expect(names).toContain("r02.html");
    // 令和7年は index.html
    expect(names).toContain("index.html");
    expect(names).not.toContain("r07.html");
  });

  it("h18.html から h31.html が含まれる", () => {
    const names = buildIndexFileNames();
    for (let i = 18; i <= 31; i++) {
      expect(names).toContain(`h${String(i).padStart(2, "0")}.html`);
    }
  });

  it("r02.html から r06.html が含まれる", () => {
    const names = buildIndexFileNames();
    for (let i = 2; i <= 6; i++) {
      expect(names).toContain(`r${String(i).padStart(2, "0")}.html`);
    }
  });

  it("合計20ファイル名を生成する（平成14 + 令和5 + index.html）", () => {
    const names = buildIndexFileNames();
    expect(names).toHaveLength(20);
  });
});

describe("indexFileNameToYear", () => {
  it("h18.html -> 2006 を返す", () => {
    expect(indexFileNameToYear("h18.html")).toBe(2006);
  });

  it("h31.html -> 2019 を返す", () => {
    expect(indexFileNameToYear("h31.html")).toBe(2019);
  });

  it("r02.html -> 2020 を返す", () => {
    expect(indexFileNameToYear("r02.html")).toBe(2020);
  });

  it("r06.html -> 2024 を返す", () => {
    expect(indexFileNameToYear("r06.html")).toBe(2024);
  });

  it("index.html -> 2025 を返す（令和7年・最新年）", () => {
    expect(indexFileNameToYear("index.html")).toBe(2025);
  });

  it("不正なファイル名は null を返す", () => {
    expect(indexFileNameToYear("r07.htm")).toBeNull();
    expect(indexFileNameToYear("invalid.html")).toBeNull();
  });
});

describe("parseMeetingTitle", () => {
  it("令和7年の会議名を抽出する", () => {
    const html = `
      <html><body>
      <h2>令和７年第１回定例会</h2>
      </body></html>
    `;
    expect(parseMeetingTitle(html)).toBe("令和７年第１回定例会");
  });

  it("平成年の会議名を抽出する", () => {
    const html = `
      <html><body>
      <h2>平成18年第1回定例会</h2>
      </body></html>
    `;
    expect(parseMeetingTitle(html)).toBe("平成18年第1回定例会");
  });

  it("会議名がない場合は null を返す", () => {
    const html = "<html><body>会議録一覧</body></html>";
    expect(parseMeetingTitle(html)).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("会議録リンクを抽出する", () => {
    const html = `
      <a href="./r07/03040001.htm">３月４日（開会、一般質問）</a>
      <a href="./r07/03062001.htm">３月６日（予算審査特別委員会）</a>
    `;
    const results = parseIndexPage(html, 2025, "令和７年第１回定例会");

    expect(results).toHaveLength(2);
    expect(results[0]!.yearDir).toBe("r07");
    expect(results[0]!.fileName).toBe("03040001.htm");
    expect(results[0]!.linkText).toBe("３月４日（開会、一般質問）");
    expect(results[1]!.yearDir).toBe("r07");
    expect(results[1]!.fileName).toBe("03062001.htm");
  });

  it("連番 0000 の目次ファイルはスキップする", () => {
    const html = `
      <a href="./r07/03040000.htm">目次</a>
      <a href="./r07/03040001.htm">３月４日（開会）</a>
    `;
    const results = parseIndexPage(html, 2025, "令和７年第１回定例会");

    expect(results).toHaveLength(1);
    expect(results[0]!.fileName).toBe("03040001.htm");
  });

  it("重複リンクは一度だけ返す", () => {
    const html = `
      <a href="./r07/03040001.htm">３月４日（開会）</a>
      <a href="./r07/03040001.htm">３月４日（再掲）</a>
    `;
    const results = parseIndexPage(html, 2025, "令和７年第１回定例会");
    expect(results).toHaveLength(1);
  });

  it("平成年のリンクも抽出できる", () => {
    const html = `
      <a href="./h18/03070101.htm">３月７日（正副議長選挙）</a>
    `;
    const results = parseIndexPage(html, 2006, "平成18年第1回定例会");

    expect(results).toHaveLength(1);
    expect(results[0]!.yearDir).toBe("h18");
    expect(results[0]!.fileName).toBe("03070101.htm");
  });
});

describe("extractHeldOnFromLinkText", () => {
  it("全角数字の月日を変換して日付を返す", () => {
    expect(extractHeldOnFromLinkText("３月４日（開会、一般質問）", 2025)).toBe("2025-03-04");
  });

  it("半角数字の月日も対応する", () => {
    expect(extractHeldOnFromLinkText("3月4日（開会）", 2025)).toBe("2025-03-04");
  });

  it("1桁月日も正しくゼロパディングする", () => {
    expect(extractHeldOnFromLinkText("６月１日（開会）", 2024)).toBe("2024-06-01");
  });

  it("2桁月日を返す", () => {
    expect(extractHeldOnFromLinkText("１２月２０日（閉会）", 2024)).toBe("2024-12-20");
  });

  it("月日パターンがない場合は null を返す", () => {
    expect(extractHeldOnFromLinkText("目次", 2025)).toBeNull();
  });
});

describe("buildFallbackTitle", () => {
  it("連番 2000 台は予算審査特別委員会", () => {
    expect(buildFallbackTitle("r07", "03062001.htm")).toBe("予算審査特別委員会");
  });

  it("連番 2600 台は決算審査特別委員会", () => {
    expect(buildFallbackTitle("r07", "09052601.htm")).toBe("決算審査特別委員会");
  });

  it("連番 100 台は臨時会", () => {
    expect(buildFallbackTitle("r07", "01150101.htm")).toBe("臨時会");
  });

  it("連番 0001 以上は年度ディレクトリを返す", () => {
    expect(buildFallbackTitle("r07", "03040001.htm")).toBe("r07");
  });
});
