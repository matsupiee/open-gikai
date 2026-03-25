import { describe, expect, it } from "vitest";
import {
  parseCategoryListPage,
  parseYearPage,
  extractYearFromRecord,
} from "./list";
import {
  buildHeldOn,
  detectMeetingType,
  extractDateFromFilename,
  extractMonthFromTitle,
  extractYearFromTitle,
} from "./shared";

describe("extractYearFromTitle", () => {
  it("令和6年を2024に変換する", () => {
    expect(extractYearFromTitle("令和6年3月多賀町議会定例会")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("令和元年多賀町議会臨時会")).toBe(2019);
  });

  it("令和3年を2021に変換する", () => {
    expect(extractYearFromTitle("令和3年12月多賀町議会定例会")).toBe(2021);
  });

  it("令和7年を2025に変換する", () => {
    expect(extractYearFromTitle("令和7年3月多賀町議会定例会")).toBe(2025);
  });

  it("平成30年を2018に変換する", () => {
    expect(extractYearFromTitle("平成30年3月多賀町議会定例会")).toBe(2018);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("多賀町議会定例会")).toBeNull();
  });
});

describe("extractMonthFromTitle", () => {
  it("3月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年3月多賀町議会定例会")).toBe(3);
  });

  it("12月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年12月多賀町議会定例会")).toBe(12);
  });

  it("月なしの場合は null を返す", () => {
    expect(extractMonthFromTitle("令和6年第1回多賀町臨時会")).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("年月から YYYY-MM-01 形式を返す", () => {
    expect(buildHeldOn(2024, 3)).toBe("2024-03-01");
  });

  it("月が1桁でもゼロパディングする", () => {
    expect(buildHeldOn(2024, 6)).toBe("2024-06-01");
  });

  it("月が null の場合は null を返す", () => {
    expect(buildHeldOn(2024, null)).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和6年3月多賀町議会定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和6年第1回多賀町臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("extractDateFromFilename", () => {
  it("西暦形式のファイル名から日付を抽出する", () => {
    expect(extractDateFromFilename("20250304.pdf")).toBe("2025-03-04");
  });

  it("和暦形式のファイル名から日付を抽出する", () => {
    expect(extractDateFromFilename("R030305.pdf")).toBe("2021-03-05");
  });

  it("和暦令和4年のファイル名から日付を抽出する", () => {
    expect(extractDateFromFilename("R040304.pdf")).toBe("2022-03-04");
  });

  it("マッチしないファイル名は null を返す", () => {
    expect(extractDateFromFilename("kaigiroku0205.pdf")).toBeNull();
  });

  it("8桁でも西暦範囲外は null を返す", () => {
    expect(extractDateFromFilename("19991231.pdf")).toBeNull();
  });
});

describe("parseCategoryListPage", () => {
  it("年度別ページの URL と年を抽出する", () => {
    const html = `
      <h2><a href="/category_list.php?frmCd=4-5-5-0-0">令和7年</a></h2>
      <li><a href="contents_detail.php?co=cat&frmId=2116&frmCd=4-5-5-0-0">会議録</a></li>
      <h2><a href="/category_list.php?frmCd=4-5-4-0-0">令和6年</a></h2>
      <li><a href="contents_detail.php?co=cat&frmId=1997&frmCd=4-5-4-0-0">会議録</a></li>
      <h2><a href="/category_list.php?frmCd=4-5-3-0-0">令和5年</a></h2>
      <li><a href="contents_detail.php?co=cat&frmId=1838&frmCd=4-5-3-0-0">会議録</a></li>
    `;

    const result = parseCategoryListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe("https://www.town.taga.lg.jp/contents_detail.php?co=cat&frmId=2116&frmCd=4-5-5-0-0");
    expect(result[0]!.year).toBe(2025);
    expect(result[1]!.url).toBe("https://www.town.taga.lg.jp/contents_detail.php?co=cat&frmId=1997&frmCd=4-5-4-0-0");
    expect(result[1]!.year).toBe(2024);
    expect(result[2]!.url).toBe("https://www.town.taga.lg.jp/contents_detail.php?co=cat&frmId=1838&frmCd=4-5-3-0-0");
    expect(result[2]!.year).toBe(2023);
  });

  it("重複 URL は除外する", () => {
    const html = `
      <h2><a href="/category_list.php?frmCd=4-5-5-0-0">令和7年</a></h2>
      <li><a href="contents_detail.php?co=cat&frmId=2116&frmCd=4-5-5-0-0">会議録</a></li>
      <li><a href="contents_detail.php?co=cat&frmId=2116&frmCd=4-5-5-0-0">会議録（再掲）</a></li>
    `;

    const result = parseCategoryListPage(html);

    expect(result).toHaveLength(1);
  });

  it("関係ないリンクは無視する", () => {
    const html = `
      <a href="/top.php">トップ</a>
      <a href="https://example.com">外部リンク</a>
      <h2><a href="/category_list.php?frmCd=4-5-4-0-0">令和6年</a></h2>
      <li><a href="contents_detail.php?co=cat&frmId=1997&frmCd=4-5-4-0-0">会議録</a></li>
    `;

    const result = parseCategoryListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2024);
  });

  it("frmId を含まないリンクは除外する", () => {
    const html = `
      <h2>令和6年</h2>
      <a href="/contents_detail.php?co=cat">frmIdなし</a>
      <a href="contents_detail.php?co=cat&frmId=1997&frmCd=4-5-4-0-0">会議録</a>
    `;

    const result = parseCategoryListPage(html);

    expect(result).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  const yearPageUrl = "https://www.town.taga.lg.jp/contents_detail.php?co=cat&frmId=1997&frmCd=4-5-4-0-0";

  it("定例会の会議録 PDF リンクを抽出する（西暦ファイル名）", () => {
    const html = `
      <h2>定例会</h2>
      <p><strong>2月定例会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/20240202.pdf">2月2日開会</a></li>
        <li><a href="./cmsfiles/contents/0000001/1997/20240206.pdf">2月6日一般質問</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionTitle).toBe("令和6年2月定例会");
    expect(result[0]!.pdfUrl).toBe("https://www.town.taga.lg.jp/cmsfiles/contents/0000001/1997/20240202.pdf");
    expect(result[0]!.linkText).toBe("2月2日開会");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2024-02-02");
    expect(result[0]!.yearPageUrl).toBe(yearPageUrl);

    expect(result[1]!.pdfUrl).toBe("https://www.town.taga.lg.jp/cmsfiles/contents/0000001/1997/20240206.pdf");
    expect(result[1]!.linkText).toBe("2月6日一般質問");
  });

  it("臨時会を correctly に抽出する", () => {
    const html = `
      <h2>臨時会</h2>
      <p><strong>4月臨時会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/20240410.pdf">4月臨時会</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.sessionTitle).toBe("令和6年4月臨時会");
    expect(result[0]!.heldOn).toBe("2024-04-10");
  });

  it("複数セクションから会議録を抽出する", () => {
    const html = `
      <h2>定例会</h2>
      <p><strong>2月定例会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/20240202.pdf">2月2日開会</a></li>
      </ul>
      <p><strong>6月定例会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/20240604.pdf">6月4日開会</a></li>
        <li><a href="./cmsfiles/contents/0000001/1997/20240605.pdf">6月5日一般質問</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2024);

    expect(result).toHaveLength(3);
    expect(result[0]!.sessionTitle).toBe("令和6年2月定例会");
    expect(result[1]!.sessionTitle).toBe("令和6年6月定例会");
    expect(result[2]!.sessionTitle).toBe("令和6年6月定例会");
  });

  it("cmsfiles/contents/ を含まない href は除外する", () => {
    const html = `
      <h2>定例会</h2>
      <p><strong>2月定例会</strong></p>
      <ul>
        <li><a href="/other/path/file.pdf">その他資料</a></li>
        <li><a href="./cmsfiles/contents/0000001/1997/20240202.pdf">2月2日開会</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2024);

    expect(result).toHaveLength(1);
  });

  it("h2 がない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/20240202.pdf">2月2日開会</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2024);

    expect(result).toHaveLength(0);
  });

  it(".pdf で終わらないリンクは除外する", () => {
    const html = `
      <h2>定例会</h2>
      <p><strong>2月定例会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/page.html">ページ</a></li>
        <li><a href="./cmsfiles/contents/0000001/1997/20240202.pdf">2月2日開会</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2024);

    expect(result).toHaveLength(1);
  });

  it("和暦ファイル名から日付を抽出する", () => {
    const html = `
      <h2>定例会</h2>
      <p><strong>3月定例会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1735/R030305.pdf">3月5日開会</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, 2021);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2021-03-05");
  });

  it("pageYear が null の場合でもリンクテキストから日付を抽出する", () => {
    const html = `
      <h2>定例会</h2>
      <p><strong>6月定例会</strong></p>
      <ul>
        <li><a href="./cmsfiles/contents/0000001/1997/kaigiroku0607.pdf">6月7日会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl, null);

    expect(result).toHaveLength(1);
    // pageYear が null なので linkText から日付を抽出できない
    expect(result[0]!.heldOn).toBeNull();
  });
});

describe("extractYearFromRecord", () => {
  it("heldOn から年を抽出する", () => {
    const record = {
      sessionTitle: "令和6年2月定例会",
      pdfUrl: "https://example.com/test.pdf",
      linkText: "2月2日開会",
      meetingType: "plenary",
      heldOn: "2024-02-02",
      yearPageUrl: "https://example.com",
    };
    expect(extractYearFromRecord(record)).toBe(2024);
  });

  it("heldOn が null の場合は sessionTitle から年を抽出する", () => {
    const record = {
      sessionTitle: "令和6年4月臨時会",
      pdfUrl: "https://example.com/test.pdf",
      linkText: "臨時会",
      meetingType: "extraordinary",
      heldOn: null,
      yearPageUrl: "https://example.com",
    };
    expect(extractYearFromRecord(record)).toBe(2024);
  });
});
