import { describe, it, expect } from "vitest";
import {
  parseTreeJson,
  parsePageYear,
  parsePeriodDate,
  parseYearPage,
} from "./list";

describe("parseTreeJson", () => {
  it("年度ページ一覧を抽出する", () => {
    const json = [
      { page_no: 3040, page_name: "令和6年度会議記録" },
      { page_no: 2760, page_name: "令和5年度会議記録" },
      { page_no: 1274, page_name: "令和3年度会議記録" },
    ];

    const pages = parseTreeJson(json);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.pageNo).toBe(3040);
    expect(pages[0]!.pageName).toBe("令和6年度会議記録");
    expect(pages[0]!.url).toContain("3040.html");
  });

  it("一般質問(結果)ページ (page_no: 1285) を除外する", () => {
    const json = [
      { page_no: 3040, page_name: "令和6年度会議記録" },
      { page_no: 1285, page_name: "会議記録(一般質問(結果))" },
      { page_no: 2760, page_name: "令和5年度会議記録" },
    ];

    const pages = parseTreeJson(json);

    expect(pages).toHaveLength(2);
    expect(pages.every((p) => p.pageNo !== 1285)).toBe(true);
  });

  it("page_name が空のエントリを除外する", () => {
    const json = [
      { page_no: 3040, page_name: "" },
      { page_no: 2760, page_name: "令和5年度" },
    ];

    const pages = parseTreeJson(json);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.pageNo).toBe(2760);
  });

  it("配列でない入力は空配列を返す", () => {
    expect(parseTreeJson(null)).toEqual([]);
    expect(parseTreeJson("string")).toEqual([]);
    expect(parseTreeJson({})).toEqual([]);
  });

  it("page_no が文字列でも処理できる", () => {
    const json = [{ page_no: "3040", page_name: "令和6年度" }];
    const pages = parseTreeJson(json);
    expect(pages[0]!.pageNo).toBe(3040);
  });
});

describe("parsePageYear", () => {
  it("令和6年度を 2024 に変換する", () => {
    expect(parsePageYear("令和6年度会議記録")).toBe(2024);
  });

  it("令和元年を 2019 に変換する", () => {
    expect(parsePageYear("令和元年度")).toBe(2019);
  });

  it("平成31年を 2019 に変換する", () => {
    expect(parsePageYear("平成31年度")).toBe(2019);
  });

  it("平成30年を 2018 に変換する", () => {
    expect(parsePageYear("平成30年度")).toBe(2018);
  });

  it("年度情報がない場合は null を返す", () => {
    expect(parsePageYear("会議記録")).toBeNull();
    expect(parsePageYear("")).toBeNull();
  });
});

describe("parsePeriodDate", () => {
  it("令和6年3月1日から開始日を抽出する", () => {
    expect(parsePeriodDate("令和6年3月1日～3月15日")).toBe("2024-03-01");
  });

  it("令和6年12月1日から開始日を抽出する", () => {
    expect(parsePeriodDate("令和6年12月1日～12月10日")).toBe("2024-12-01");
  });

  it("令和元年6月を処理する", () => {
    expect(parsePeriodDate("令和元年6月3日～6月14日")).toBe("2019-06-03");
  });

  it("平成31年3月を処理する", () => {
    expect(parsePeriodDate("平成31年3月4日～3月15日")).toBe("2019-03-04");
  });

  it("全角数字を処理する", () => {
    expect(parsePeriodDate("令和６年３月１日～３月１５日")).toBe("2024-03-01");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parsePeriodDate("第1回定例会")).toBeNull();
    expect(parsePeriodDate("")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("PDF リンクを正しく抽出する", () => {
    const html = `
      <h2><span class="bg"><span class="bg2"><span class="bg3">第1回定例会</span></span></span></h2>
      <h3><span class="bg"><span class="bg2"><span class="bg3">令和6年3月1日～3月15日</span></span></span></h3>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.okutama.tokyo.jp/material/files/group/11/honnkaigi1.pdf">
          本会議1日目 (PDFファイル: 1.1MB)
        </a>
      </p>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.okutama.tokyo.jp/material/files/group/11/honnkaigi2.pdf">
          本会議2日目 (PDFファイル: 1.2MB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.okutama.tokyo.jp/material/files/group/11/honnkaigi1.pdf",
    );
    expect(meetings[0]!.title).toBe("第1回定例会 本会議1日目");
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[0]!.meetingType).toBe("plenary");
    expect(meetings[1]!.pdfUrl).toContain("honnkaigi2.pdf");
    expect(meetings[1]!.heldOn).toBe("2024-03-01");
  });

  it("Word ファイル (.doc) をスキップする", () => {
    const html = `
      <h2><span>第1回定例会</span></h2>
      <h3><span>平成22年3月1日～3月15日</span></h3>
      <p class="file-link-item">
        <a class="word" href="//www.town.okutama.tokyo.jp/material/files/group/11/kaigi.doc">
          本会議1日目 (Wordファイル: 342.5KB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(0);
  });

  it("委員会会議は committee タイプとして検出する", () => {
    const html = `
      <h2><span>予算特別委員会</span></h2>
      <h3><span>令和6年3月5日</span></h3>
      <p class="file-link-item">
        <a class="pdf" href="//example.com/yosan.pdf">
          予算特別委員会1日目 (PDFファイル: 0.8MB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("committee");
  });

  it("臨時会は extraordinary タイプとして検出する", () => {
    const html = `
      <h2><span>第1回臨時会</span></h2>
      <h3><span>令和6年5月10日</span></h3>
      <p class="file-link-item">
        <a class="pdf" href="//example.com/rinji.pdf">
          本会議 (PDFファイル: 0.5MB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("複数の会議セクションを処理する", () => {
    const html = `
      <h2><span>第1回定例会</span></h2>
      <h3><span>令和6年3月1日～3月15日</span></h3>
      <p class="file-link-item">
        <a class="pdf" href="//example.com/teireikai1.pdf">本会議1日目 (PDFファイル: 1.0MB)</a>
      </p>
      <h2><span>第2回定例会</span></h2>
      <h3><span>令和6年6月10日～6月20日</span></h3>
      <p class="file-link-item">
        <a class="pdf" href="//example.com/teireikai2.pdf">本会議1日目 (PDFファイル: 1.1MB)</a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[1]!.heldOn).toBe("2024-06-10");
    expect(meetings[0]!.title).toContain("第1回定例会");
    expect(meetings[1]!.title).toContain("第2回定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>令和6年</p></div>`;
    expect(parseYearPage(html)).toHaveLength(0);
  });

  it("heldOn は会期が解析できない場合 null になる", () => {
    const html = `
      <h2><span>第1回定例会</span></h2>
      <p class="file-link-item">
        <a class="pdf" href="//example.com/test.pdf">本会議1日目 (PDFファイル: 1.0MB)</a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("プロトコル相対 URL を https: に変換する", () => {
    const html = `
      <h2><span>第1回定例会</span></h2>
      <h3><span>令和6年3月1日</span></h3>
      <p class="file-link-item">
        <a class="pdf" href="//www.town.okutama.tokyo.jp/material/files/group/11/test.pdf">
          本会議1日目 (PDFファイル: 1.0MB)
        </a>
      </p>
    `;

    const meetings = parseYearPage(html);

    expect(meetings[0]!.pdfUrl).toMatch(/^https:\/\//);
  });
});
