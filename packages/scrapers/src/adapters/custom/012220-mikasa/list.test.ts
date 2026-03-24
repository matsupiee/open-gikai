import { describe, expect, it } from "vitest";
import { parsePdfLinkText, parseCategoryPage, parseYearDetailPage } from "./list";
import { convertWarekiYear, toHalfWidth } from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和７年１２月１８日")).toBe("令和7年12月18日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });

  it("全角半角が混在する文字列を処理する", () => {
    expect(toHalfWidth("第４回定例会12月18日")).toBe("第4回定例会12月18日");
  });
});

describe("convertWarekiYear", () => {
  it("令和7年を2025年に変換する", () => {
    expect(convertWarekiYear("令和", "7")).toBe(2025);
  });

  it("令和元年を2019年に変換する", () => {
    expect(convertWarekiYear("令和", "元")).toBe(2019);
  });

  it("令和1年を2019年に変換する", () => {
    expect(convertWarekiYear("令和", "1")).toBe(2019);
  });

  it("平成17年を2005年に変換する", () => {
    expect(convertWarekiYear("平成", "17")).toBe(2005);
  });

  it("未対応の元号はnullを返す", () => {
    expect(convertWarekiYear("昭和", "50")).toBeNull();
  });
});

describe("parsePdfLinkText", () => {
  it("令和7年 第4回定例会をパースする", () => {
    const result = parsePdfLinkText("会議録 令和7年 第4回定例会 12月18日");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第4回定例会 12月18日");
    expect(result!.heldOn).toBe("2025-12-18");
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("plenary");
  });

  it("令和7年 第1回臨時会をパースする", () => {
    const result = parsePdfLinkText("会議録 令和7年 第1回臨時会 1月24日");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回臨時会 1月24日");
    expect(result!.heldOn).toBe("2025-01-24");
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("令和7年 第1回定例会をパースする", () => {
    const result = parsePdfLinkText("会議録 令和7年 第1回定例会 3月3日");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会 3月3日");
    expect(result!.heldOn).toBe("2025-03-03");
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("plenary");
  });

  it("令和元年をパースする", () => {
    const result = parsePdfLinkText("会議録 令和元年 第3回定例会 9月12日");

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-09-12");
    expect(result!.year).toBe(2019);
  });

  it("平成17年をパースする", () => {
    const result = parsePdfLinkText("会議録 平成17年 第1回定例会 3月10日");

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2005-03-10");
    expect(result!.year).toBe(2005);
  });

  it("全角数字を含むテキストをパースする", () => {
    const result = parsePdfLinkText("会議録 令和７年 第４回定例会 １２月１８日");

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2025-12-18");
    expect(result!.year).toBe(2025);
  });

  it("パターンに合致しないテキストはnullを返す", () => {
    expect(parsePdfLinkText("議事日程")).toBeNull();
    expect(parsePdfLinkText("会議録")).toBeNull();
    expect(parsePdfLinkText("令和7年 第4回定例会")).toBeNull();
  });
});

describe("parseCategoryPage", () => {
  it("年度別詳細ページのURLを収集する", () => {
    const html = `
      <html>
      <body>
        <a href="/assembly/detail/00016816.html">会議録 令和8年</a>
        <a href="/assembly/detail/00016223.html">会議録 令和7年</a>
        <a href="/assembly/detail/00001190.html">会議録 平成17年</a>
        <a href="/hotnews/category/307.html">戻る</a>
      </body>
      </html>
    `;

    const result = parseCategoryPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.city.mikasa.hokkaido.jp/assembly/detail/00016816.html");
    expect(result[1]).toBe("https://www.city.mikasa.hokkaido.jp/assembly/detail/00016223.html");
    expect(result[2]).toBe("https://www.city.mikasa.hokkaido.jp/assembly/detail/00001190.html");
  });

  it("同じURLの重複を除外する", () => {
    const html = `
      <a href="/assembly/detail/00016223.html">令和7年（1）</a>
      <a href="/assembly/detail/00016223.html">令和7年（2）</a>
    `;

    const result = parseCategoryPage(html);
    expect(result).toHaveLength(1);
  });

  it("assembly/detail 以外のリンクは除外する", () => {
    const html = `
      <a href="/hotnews/category/307.html">カテゴリ</a>
      <a href="/assembly/list.html">一覧</a>
    `;

    expect(parseCategoryPage(html)).toHaveLength(0);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseCategoryPage("<html><body>テキスト</body></html>")).toEqual([]);
  });
});

describe("parseYearDetailPage", () => {
  it("年度別詳細ページから PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <a href="/hotnews/files/00016200/00016223/20260220172758.pdf">会議録 令和7年 第4回定例会 12月18日</a>
        <a href="/hotnews/files/00016200/00016223/20260220172759.pdf">会議録 令和7年 第1回臨時会 1月24日</a>
        <a href="/hotnews/files/00016200/00016223/20260220172760.pdf">会議録 令和7年 第1回定例会 3月3日</a>
        <a href="/hotnews/category/307.html">カテゴリへ戻る</a>
      </body>
      </html>
    `;

    const result = parseYearDetailPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("第4回定例会 12月18日");
    expect(result[0]!.heldOn).toBe("2025-12-18");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.mikasa.hokkaido.jp/hotnews/files/00016200/00016223/20260220172758.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2025);

    expect(result[1]!.title).toBe("第1回臨時会 1月24日");
    expect(result[1]!.heldOn).toBe("2025-01-24");
    expect(result[1]!.meetingType).toBe("extraordinary");

    expect(result[2]!.title).toBe("第1回定例会 3月3日");
    expect(result[2]!.heldOn).toBe("2025-03-03");
  });

  it("PDF でないリンクは除外する", () => {
    const html = `
      <a href="/hotnews/files/00016200/00016223/20260220.pdf">会議録 令和7年 第1回定例会 3月3日</a>
      <a href="/assembly/detail/00016223.html">年度別一覧</a>
    `;

    const result = parseYearDetailPage(html);
    expect(result).toHaveLength(1);
  });

  it("パースできないリンクテキストは除外する", () => {
    const html = `
      <a href="/hotnews/files/00016200/00016223/20260220172758.pdf">議事日程</a>
      <a href="/hotnews/files/00016200/00016223/20260220172759.pdf">会議録 令和7年 第1回定例会 3月3日</a>
    `;

    const result = parseYearDetailPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会 3月3日");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません</p></div>`;
    expect(parseYearDetailPage(html)).toEqual([]);
  });
});
