import { describe, it, expect } from "vitest";
import { parseListPage, parseMeetingText, parseDetailPage } from "./list";

describe("parseMeetingText", () => {
  it("定例会のテキストをパースする", () => {
    const result = parseMeetingText(
      "第１回　定　例　会　（　３月１０日〜１１日）",
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("定例会");
    expect(result!.month).toBe(3);
    expect(result!.day).toBe(10);
  });

  it("臨時会のテキストをパースする", () => {
    const result = parseMeetingText(
      "第１回　　臨　時　会　（　１月１６日）　",
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("臨時会");
    expect(result!.month).toBe(1);
    expect(result!.day).toBe(16);
  });

  it("全角数字の月日を正しく変換する", () => {
    const result = parseMeetingText(
      "第４回　定　例　会　（１２月１１日）",
    );
    expect(result).not.toBeNull();
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(11);
  });

  it("月の前にスペースが入った日付をパースする", () => {
    const result = parseMeetingText(
      "第１回　　臨　時　会　（　２月　５日）　",
    );
    expect(result).not.toBeNull();
    expect(result!.month).toBe(2);
    expect(result!.day).toBe(5);
  });

  it("定例会でも臨時会でもないテキストは null を返す", () => {
    const result = parseMeetingText("第２回　定　例　会　");
    expect(result).toBeNull();
  });

  it("日付のないテキストは null を返す", () => {
    const result = parseMeetingText("定例会テスト");
    expect(result).toBeNull();
  });
});

describe("parseListPage", () => {
  it("令和年代のリンクをパースする", () => {
    const html = `
      <td>令和８年</td>
      <a href="honkaigiR8/honkaigiR8-03-1.html" target="_blank">第１回　定　例　会　（　３月１０日〜１１日）</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toMatch(/第1回 定 例 会/);
    expect(meetings[0]!.heldOn).toBe("2026-03-10");
    expect(meetings[0]!.category).toBe("定例会");
    expect(meetings[0]!.year).toBe(2026);
    expect(meetings[0]!.detailUrl).toBe(
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigiR8/honkaigiR8-03-1.html",
    );
  });

  it("臨時会をパースする", () => {
    const html = `
      <a href="honkaigiR8/honkaigiR8-02.html" target="_blank">第１回　　臨　時　会　（　２月２０日）　</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.category).toBe("臨時会");
    expect(meetings[0]!.heldOn).toBe("2026-02-20");
  });

  it("令和7年の複数のリンクをパースする", () => {
    const html = `
      <a href="honkaigiR7/honkaigiR7-03-1.html" target="_blank">第１回　定　例　会　（　３月５日〜６日）</a>
      <a href="honkaigiR7/honkaigiR7-01.html" target="_blank">第１回　　臨　時　会　（　１月１６日）　</a>
      <a href="honkaigiR7/honkaigiR7-06-1.html" target="_blank">第２回　定　例　会　（　６月１９日）</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[1]!.heldOn).toBe("2025-01-16");
    expect(meetings[1]!.category).toBe("臨時会");
    expect(meetings[2]!.heldOn).toBe("2025-06-19");
  });

  it("平成年代のリンクをパースする", () => {
    const html = `
      <a href="honkaigi24/honkaigi24-1.html" target="_blank">第１回　定　例　会　（　３月１２日〜１３日）</a>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2012-03-12");
    expect(meetings[0]!.year).toBe(2012);
  });

  it("リンクのないテキストはスキップする", () => {
    const html = `
      <td>令和８年</td>
      <span>第２回　定　例　会　</span>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });

  it("閉じカッコが a タグの外にある場合でもパースできる", () => {
    const html = `
      <a href="honkaigiR7/honkaigiR7-06-2.html" target="_blank">第４回　　臨　時　会　（　６月３０日</a>）
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-06-30");
  });
});

describe("parseDetailPage", () => {
  it("kaigiroku/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <a href="kaigiroku/250305teireikai/20250305teirei-total.pdf" target="_blank">第1号</a>
      <a href="kaigiroku/250305teireikai/20250306teirei-total.pdf" target="_blank">第2号</a>
      <a href="kaigiroku/250305teireikai/20250305teirei01.pdf" target="_blank">01</a>
      <a href="gian-siryou/250305teireikai/250305gian.pdf" target="_blank">議案</a>
    `;

    const baseUrl =
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigiR7/honkaigiR7-03-1.html";
    const pdfs = parseDetailPage(html, baseUrl);

    // -total.pdf がある場合はそちらのみ返す
    expect(pdfs).toHaveLength(2);
    expect(pdfs[0]).toBe(
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigiR7/kaigiroku/250305teireikai/20250305teirei-total.pdf",
    );
    expect(pdfs[1]).toBe(
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigiR7/kaigiroku/250305teireikai/20250306teirei-total.pdf",
    );
  });

  it("-total.pdf がない場合は個別 PDF を全て返す", () => {
    const html = `
      <a href="kaigiroku/120220rinji.pdf" target="_blank">会議録</a>
    `;

    const baseUrl =
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigi24/honkaigi24-1.html";
    const pdfs = parseDetailPage(html, baseUrl);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]).toBe(
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigi24/kaigiroku/120220rinji.pdf",
    );
  });

  it("gian-siryou/ や houkoku-sonota/ のリンクは除外する", () => {
    const html = `
      <a href="gian-siryou/250305teireikai/250305gian.pdf" target="_blank">議案</a>
      <a href="houkoku-sonota/250305teirei/syohan.pdf" target="_blank">諸般</a>
    `;

    const baseUrl =
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigiR7/honkaigiR7-03-1.html";
    const pdfs = parseDetailPage(html, baseUrl);

    expect(pdfs).toHaveLength(0);
  });

  it("重複する PDF リンクは除外する", () => {
    const html = `
      <a href="kaigiroku/120220rinji.pdf" target="_blank">会議録</a>
      <a href="kaigiroku/120220rinji.pdf" target="_blank">会議録</a>
    `;

    const baseUrl =
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigi24/honkaigi24-1.html";
    const pdfs = parseDetailPage(html, baseUrl);

    expect(pdfs).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    const baseUrl =
      "https://www.hokkaido-esashi.jp/gikai/h24-honkaigi/honkaigiR7/honkaigiR7-03-1.html";
    expect(parseDetailPage("", baseUrl)).toEqual([]);
  });
});
