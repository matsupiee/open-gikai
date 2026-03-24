import { describe, it, expect } from "vitest";
import { extractHeldOn, extractYearFromHeading, parseListPage } from "./list";

describe("extractYearFromHeading", () => {
  it("令和7年 を 2025 に変換する", () => {
    expect(extractYearFromHeading("令和7年")).toBe(2025);
  });

  it("令和8年 を 2026 に変換する", () => {
    expect(extractYearFromHeading("令和8年")).toBe(2026);
  });

  it("令和元年 を 2019 に変換する", () => {
    expect(extractYearFromHeading("令和元年")).toBe(2019);
  });

  it("平成29年 を 2017 に変換する", () => {
    expect(extractYearFromHeading("平成29年")).toBe(2017);
  });

  it("委員会名付きの見出しから年を抽出する", () => {
    expect(extractYearFromHeading("令和8年（総務文教常任委員会）")).toBe(2026);
  });

  it("年号でない見出しは null を返す", () => {
    expect(extractYearFromHeading("総務文教常任委員会")).toBeNull();
    expect(extractYearFromHeading("特別委員会会議録")).toBeNull();
  });
});

describe("extractHeldOn", () => {
  it("【M月D日開催】パターンを解析する", () => {
    expect(extractHeldOn("第1回臨時会【1月16日開催】", 2025)).toBe(
      "2025-01-16",
    );
  });

  it("【M月D日～M月D日開催】パターンは初日を取得する", () => {
    expect(extractHeldOn("第１回定例会 【3月4日～3月21日開催】", 2025)).toBe(
      "2025-03-04",
    );
  });

  it("令和X年M月D日 形式を解析する", () => {
    expect(extractHeldOn("令和8年3月3日", null)).toBe("2026-03-03");
  });

  it("令和X年M月D日（委員会ページ形式）を解析する", () => {
    expect(extractHeldOn("令和7年6月12日", null)).toBe("2025-06-12");
  });

  it("【令和X年M月D日開催】パターンを解析する", () => {
    expect(
      extractHeldOn(
        "【令和7年9月17、18、19日開催】令和6年度決算審査特別委員会",
        null,
      ),
    ).toBe("2025-09-17");
  });

  it("令和元年 を 2019 として解析する", () => {
    expect(extractHeldOn("令和元年12月20日", null)).toBe("2019-12-20");
  });

  it("平成年号を解析する", () => {
    expect(extractHeldOn("平成30年5月10日", null)).toBe("2018-05-10");
  });

  it("currentYear が null で日付テキストのみの場合は null を返す", () => {
    expect(extractHeldOn("第1回定例会【3月4日開催】", null)).toBeNull();
  });

  it("月日テキストがない場合は null を返す", () => {
    expect(extractHeldOn("資料一覧", 2025)).toBeNull();
  });

  it("1桁の月日をゼロ埋めする", () => {
    expect(extractHeldOn("令和7年1月24日", null)).toBe("2025-01-24");
  });
});

describe("parseListPage", () => {
  it("定例会・臨時会ページの構造をパースする", () => {
    const html = `
      <h2>令和7年</h2>
      <ul>
        <li><a href="/assets/images/makubetsu/20250116-file.pdf">第1回臨時会【1月16日開催】</a></li>
        <li><a href="/chosei/gikai/gikai_kaigiroku/teireirinjikaigiroku/files/2025-1t.pdf">第１回定例会 【3月4日～3月21日開催】</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("第1回臨時会【1月16日開催】");
    expect(meetings[0]!.heldOn).toBe("2025-01-16");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.makubetsu.lg.jp/assets/images/makubetsu/20250116-file.pdf",
    );

    expect(meetings[1]!.title).toBe("第１回定例会 【3月4日～3月21日開催】");
    expect(meetings[1]!.heldOn).toBe("2025-03-04");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.makubetsu.lg.jp/chosei/gikai/gikai_kaigiroku/teireirinjikaigiroku/files/2025-1t.pdf",
    );
  });

  it("委員会ページの構造（h2=委員会名、h3=年号）をパースする", () => {
    const html = `
      <h2>総務文教常任委員会</h2>
      <h3>令和8年（総務文教常任委員会）</h3>
      <ul>
        <li><a href="/assets/images/makubetsu/20260303-file.pdf">令和8年3月3日</a>　議案審査2件</li>
      </ul>
      <h3>令和7年（総務文教常任委員会）</h3>
      <ul>
        <li><a href="/assets/images/makubetsu/20250612-file.pdf">令和7年6月12日</a>　陳情審査1件</li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和8年3月3日");
    expect(meetings[0]!.heldOn).toBe("2026-03-03");
    expect(meetings[0]!.category).toBe("総務文教常任委員会");

    expect(meetings[1]!.title).toBe("令和7年6月12日");
    expect(meetings[1]!.heldOn).toBe("2025-06-12");
  });

  it("複数年度のデータを正しくパースする", () => {
    const html = `
      <h2>令和7年</h2>
      <ul>
        <li><a href="/assets/images/makubetsu/file1.pdf">第1回臨時会【1月16日開催】</a></li>
      </ul>
      <h2>令和6年</h2>
      <ul>
        <li><a href="/chosei/gikai/gikai_kaigiroku/teireirinjikaigiroku/files/2024-1t.pdf">第1回定例会【3月1日～22日開催】</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2025-01-16");
    expect(meetings[1]!.heldOn).toBe("2024-03-01");
  });

  it("特別委員会ページの構造をパースする", () => {
    const html = `
      <h2>特別委員会会議録</h2>
      <h3>決算審査特別委員会</h3>
      <ul>
        <li><a href="/assets/images/makubetsu/file.pdf">【令和7年9月17、18、19日開催】令和6年度決算審査特別委員会</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-09-17");
  });

  it("URL エンコードされた href を正しく処理する", () => {
    const html = `
      <h2>令和7年</h2>
      <ul>
        <li><a href="/assets/images/makubetsu/%E2%97%8B20250116-%E7%AC%AC%EF%BC%91%E5%9B%9E.pdf">第1回臨時会【1月16日開催】</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("https://www.town.makubetsu.lg.jp");
    expect(meetings[0]!.pdfUrl).toContain(".pdf");
  });

  it("PDF でないリンクは除外する", () => {
    const html = `
      <h2>令和7年</h2>
      <ul>
        <li><a href="/some-page.html">ページリンク</a></li>
        <li><a href="/assets/images/makubetsu/file.pdf">第1回定例会【3月4日開催】</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });

  it("平成年号のデータを正しくパースする", () => {
    const html = `
      <h2>平成29年</h2>
      <ul>
        <li><a href="/chosei/gikai/gikai_kaigiroku/teireirinjikaigiroku/files/2017-1t.pdf">第1回定例会【3月2日～3月16日開催】</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2017-03-02");
  });
});
