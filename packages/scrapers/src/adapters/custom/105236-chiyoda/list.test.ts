import { describe, it, expect } from "vitest";
import { parseListPage, resolveUrl, estimateHeldOn, eraToWesternYear } from "./list";

describe("eraToWesternYear", () => {
  it("令和の年をパースする（全角数字）", () => {
    expect(eraToWesternYear("令和７年")).toBe(2025);
  });

  it("令和の年をパースする（半角数字）", () => {
    expect(eraToWesternYear("令和7年")).toBe(2025);
  });

  it("令和元年をパースする", () => {
    expect(eraToWesternYear("令和元年")).toBe(2019);
  });

  it("平成の年をパースする", () => {
    expect(eraToWesternYear("平成30年")).toBe(2018);
  });

  it("平成元年をパースする", () => {
    expect(eraToWesternYear("平成元年")).toBe(1989);
  });

  it("不明な形式は null を返す", () => {
    expect(eraToWesternYear("2025年")).toBeNull();
  });
});

describe("resolveUrl", () => {
  it("../files/ パスを解決する", () => {
    expect(resolveUrl("../files/8f154240d77005b93bdec7f98f36f64c.pdf")).toBe(
      "https://www.town.chiyoda.gunma.jp/files/8f154240d77005b93bdec7f98f36f64c.pdf"
    );
  });

  it("data/ パスを解決する", () => {
    expect(resolveUrl("data/T_201701.pdf")).toBe(
      "https://www.town.chiyoda.gunma.jp/gikai/data/T_201701.pdf"
    );
  });

  it("絶対 URL はそのまま返す", () => {
    expect(resolveUrl("https://example.com/test.pdf")).toBe(
      "https://example.com/test.pdf"
    );
  });

  it("/ 始まりの絶対パスを解決する", () => {
    expect(resolveUrl("/files/test.pdf")).toBe(
      "https://www.town.chiyoda.gunma.jp/files/test.pdf"
    );
  });

  it("URL エンコードされた日本語ファイル名を解決する", () => {
    expect(
      resolveUrl("../%E4%BB%A4%E5%92%8C%EF%BC%96%E5%B9%B4.pdf")
    ).toBe(
      "https://www.town.chiyoda.gunma.jp/%E4%BB%A4%E5%92%8C%EF%BC%96%E5%B9%B4.pdf"
    );
  });
});

describe("estimateHeldOn", () => {
  it("月のみの定例会から日付を推定する", () => {
    expect(estimateHeldOn("令和７年", "第4回定例会（12月）")).toBe("2025-12-01");
  });

  it("月日ありの臨時会から日付を推定する", () => {
    expect(estimateHeldOn("令和７年", "第2回臨時会（10月15日）")).toBe("2025-10-15");
  });

  it("「開催」付きの月パターンを処理する", () => {
    expect(estimateHeldOn("令和７年", "令和7年 第4回定例会（12月開催）")).toBe("2025-12-01");
  });

  it("「開催」付きの月日パターンを処理する", () => {
    expect(estimateHeldOn("令和７年", "令和7年 第2回臨時会（10月15日開催）")).toBe("2025-10-15");
  });

  it("リンクテキスト内の和暦年を優先する", () => {
    expect(estimateHeldOn("令和７年", "令和7年 第1回定例会（3月1日開催）")).toBe("2025-03-01");
  });

  it("平成の年も正しく変換する", () => {
    expect(estimateHeldOn("平成30年", "第1回定例会（3月）")).toBe("2018-03-01");
  });

  it("月情報がない場合は1月1日を返す", () => {
    expect(estimateHeldOn("令和７年", "定例会")).toBe("2025-01-01");
  });

  it("不正な和暦には null を返す", () => {
    expect(estimateHeldOn("2025年", "第1回定例会（3月）")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("年度セクションから PDF リンクを抽出する（実サイト形式）", () => {
    const html = `
      <h1>議会会議録</h1>
      <h2>令和７年</h2>
      <p><a href="../files/8f154240d77005b93bdec7f98f36f64c.pdf">令和7年 第4回定例会（12月開催）</a>（PDF/892KB)</p>
      <p><a href="../files/04122b2293b37965ae0eabeb7a4a8915.pdf">令和7年 第2回臨時会（10月15日開催）</a>（PDF/254KB）</p>
      <h2>令和６年</h2>
      <p><a href="../files/abc123def456.pdf">令和6年 第4回定例会（12月開催）</a>（PDF/890KB）</p>
    `;

    const meetings = parseListPage(html, ["令和7年"]);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和7年 第4回定例会（12月開催）");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.chiyoda.gunma.jp/files/8f154240d77005b93bdec7f98f36f64c.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2025-12-01");

    expect(meetings[1]!.title).toBe("令和7年 第2回臨時会（10月15日開催）");
    expect(meetings[1]!.heldOn).toBe("2025-10-15");
  });

  it("全角数字の年度見出しにもマッチする", () => {
    const html = `
      <h2>令和７年</h2>
      <p><a href="../files/test.pdf">令和7年 第1回定例会（3月開催）</a>（PDF/100KB）</p>
    `;

    const meetings = parseListPage(html, ["令和7年"]);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
  });

  it("平成の年度も正しく処理する", () => {
    const html = `
      <h2>平成29年</h2>
      <p><a href="data/T_201701.pdf">第1回定例会（3月）</a>（PDF/200KB）</p>
      <p><a href="data/R_20161014.pdf">第1回臨時会（10月14日）</a>（PDF/100KB）</p>
    `;

    const meetings = parseListPage(html, ["平成29年"]);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.chiyoda.gunma.jp/gikai/data/T_201701.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2017-03-01");
    expect(meetings[0]!.title).toBe("平成29年 第1回定例会（3月）");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.chiyoda.gunma.jp/gikai/data/R_20161014.pdf"
    );
    expect(meetings[1]!.heldOn).toBe("2017-10-14");
  });

  it("対象年度以外のセクションは無視する", () => {
    const html = `
      <h2>令和７年</h2>
      <p><a href="../files/aaa.pdf">令和7年 第4回定例会（12月開催）</a>（PDF/500KB）</p>
      <h2>令和６年</h2>
      <p><a href="../files/bbb.pdf">令和6年 第4回定例会（12月開催）</a>（PDF/300KB）</p>
    `;

    const meetings = parseListPage(html, ["令和6年"]);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年 第4回定例会（12月開催）");
  });

  it("リンクテキストに和暦年がない場合は h2 の年度をタイトルに付ける", () => {
    const html = `
      <h2>平成29年</h2>
      <p><a href="data/T_201701.pdf">第1回定例会（3月）</a>（PDF/200KB）</p>
    `;

    const meetings = parseListPage(html, ["平成29年"]);

    expect(meetings[0]!.title).toBe("平成29年 第1回定例会（3月）");
  });

  it("リンクテキストに和暦年がある場合はそのままタイトルにする", () => {
    const html = `
      <h2>令和７年</h2>
      <p><a href="../files/test.pdf">令和7年 第4回定例会（12月開催）</a>（PDF/892KB)</p>
    `;

    const meetings = parseListPage(html, ["令和7年"]);

    expect(meetings[0]!.title).toBe("令和7年 第4回定例会（12月開催）");
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("", ["令和7年"])).toEqual([]);
  });
});
