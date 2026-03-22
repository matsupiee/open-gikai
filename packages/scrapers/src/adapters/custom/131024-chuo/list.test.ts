import { describe, it, expect } from "vitest";
import { parseListPage, extractDateFromTitle } from "./list";

describe("extractDateFromTitle", () => {
  it("本会議タイトルから月日を抽出する", () => {
    expect(
      extractDateFromTitle(
        "令和7年第四回定例会会議録（第3日　11月25日）",
        2025,
      ),
    ).toBe("2025-11-25");
  });

  it("委員会タイトルから月日を抽出する", () => {
    expect(
      extractDateFromTitle(
        "令和7年　決算特別委員会(第11日　10月16日)",
        2025,
      ),
    ).toBe("2025-10-16");
  });

  it("日付のみのタイトルから月日を抽出する", () => {
    expect(
      extractDateFromTitle("令和7年　議会運営委員会(10月16日)", 2025),
    ).toBe("2025-10-16");
  });

  it("1桁の月日をゼロパディングする", () => {
    expect(
      extractDateFromTitle(
        "令和7年第一回定例会会議録（第1日　2月5日）",
        2025,
      ),
    ).toBe("2025-02-05");
  });

  it("日付が含まれないタイトルはnullを返す", () => {
    expect(
      extractDateFromTitle("令和7年第四回定例会会議録目次", 2025),
    ).toBeNull();
  });
});

describe("parseListPage", () => {
  it("会議録リンクを抽出し、目次リンクをスキップする", () => {
    const html = `
      <a href="../kaigiroku.cgi/r07/teireikai202504-3mokuji.html" target="OutputWin">目次</a>
      <a href="../kaigiroku.cgi/r07/teireikai202504-3.html" target="OutputWin">令和7年第四回定例会会議録（第3日　11月25日）</a>
      <a href="../kaigiroku.cgi/r07/kessan20251008.html" target="OutputWin">令和7年　決算特別委員会(第9日　10月8日)</a>
    `;

    const records = parseListPage(
      html,
      "https://www.kugikai.city.chuo.lg.jp",
      2025,
    );

    expect(records).toHaveLength(2);
    expect(records[0]!.url).toBe(
      "https://www.kugikai.city.chuo.lg.jp/kaigiroku.cgi/r07/teireikai202504-3.html",
    );
    expect(records[0]!.title).toBe(
      "令和7年第四回定例会会議録（第3日　11月25日）",
    );
    expect(records[0]!.heldOn).toBe("2025-11-25");

    expect(records[1]!.url).toBe(
      "https://www.kugikai.city.chuo.lg.jp/kaigiroku.cgi/r07/kessan20251008.html",
    );
    expect(records[1]!.heldOn).toBe("2025-10-08");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="../kaigiroku.cgi/r07/teireikai202504-3.html" target="OutputWin">リンク1（11月25日）</a>
      <a href="../kaigiroku.cgi/r07/teireikai202504-3.html" target="OutputWin">リンク2（11月25日）</a>
    `;

    const records = parseListPage(
      html,
      "https://www.kugikai.city.chuo.lg.jp",
      2025,
    );
    expect(records).toHaveLength(1);
  });
});
