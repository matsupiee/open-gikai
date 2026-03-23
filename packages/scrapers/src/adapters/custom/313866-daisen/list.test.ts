import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseSubPage } from "./list";
import { warekiToSeireki, buildDate } from "./shared";

describe("warekiToSeireki", () => {
  it("令和7年を2025に変換する", () => {
    expect(warekiToSeireki("令和7年　会議録")).toBe(2025);
  });

  it("令和元年を2019に変換する", () => {
    expect(warekiToSeireki("令和元年　会議録")).toBe(2019);
  });

  it("平成30年を2018に変換する", () => {
    expect(warekiToSeireki("平成30年　会議録")).toBe(2018);
  });

  it("平成17年を2005に変換する", () => {
    expect(warekiToSeireki("平成17年　会議録")).toBe(2005);
  });

  it("和暦がない文字列は null を返す", () => {
    expect(warekiToSeireki("会議録一覧")).toBeNull();
  });
});

describe("buildDate", () => {
  it("4月以降は同年の日付を返す", () => {
    expect(buildDate(2025, 6, 3)).toBe("2025-06-03");
  });

  it("1-3月は翌年の日付を返す（年度跨ぎ）", () => {
    expect(buildDate(2024, 2, 26)).toBe("2025-02-26");
  });

  it("12月は同年の日付を返す", () => {
    expect(buildDate(2025, 12, 18)).toBe("2025-12-18");
  });
});

const TOP_PAGE_HTML = `
<div>
  <ul>
    <li><a href="/gikai/9/r153/">令和8年　会議録</a></li>
    <li><a href="/gikai/9/m170/">令和7年　会議録</a></li>
    <li><a href="/gikai/9/r159/">令和6年　会議録</a></li>
    <li><a href="/gikai/9/c323/">令和5年　会議録</a></li>
    <li><a href="/gikai/9/7/">平成31年・令和元年　会議録</a></li>
    <li><a href="/gikai/9/6/">平成30年　会議録</a></li>
    <li><a href="/gikai/9/1/">平成25年　会議録</a></li>
    <li><a href="/gikai/9/17/">平成17年　会議録</a></li>
  </ul>
</div>
`;

describe("parseTopPage", () => {
  it("令和7年のページ URL を抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const r7 = result.find((p) => p.year === 2025);
    expect(r7).not.toBeUndefined();
    expect(r7!.url).toBe("https://www.daisen.jp/gikai/9/m170/");
  });

  it("令和6年のページ URL を抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const r6 = result.find((p) => p.year === 2024);
    expect(r6).not.toBeUndefined();
    expect(r6!.url).toBe("https://www.daisen.jp/gikai/9/r159/");
  });

  it("平成31年・令和元年を令和元年として2019に変換する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const r1 = result.find((p) => p.year === 2019);
    expect(r1).not.toBeUndefined();
    expect(r1!.url).toBe("https://www.daisen.jp/gikai/9/7/");
  });

  it("平成30年を2018に変換する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const h30 = result.find((p) => p.year === 2018);
    expect(h30).not.toBeUndefined();
    expect(h30!.url).toBe("https://www.daisen.jp/gikai/9/6/");
  });

  it("平成17年を2005に変換する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    const h17 = result.find((p) => p.year === 2005);
    expect(h17).not.toBeUndefined();
    expect(h17!.url).toBe("https://www.daisen.jp/gikai/9/17/");
  });

  it("全リンクを抽出する", () => {
    const result = parseTopPage(TOP_PAGE_HTML);
    expect(result.length).toBe(8);
  });
});

const YEAR_PAGE_HTML = `
<h2>令和7年　会議録</h2>

<p><a href="/user/filer_public/0f/a5/0fa5040b-d312-4c38-a84c-53be8c8daf10/1yue-lin-shi-hui.pdf">第1回大山町議会臨時会（1月22日）</a></p>

<p><a href="/gikai/9/m170/s125/">第2回大山町議会定例会（2月26日～3月13日）</a></p>

<p><a href="/user/filer_public/ac/16/ac164014-6e2d-4697-8909-514b9d2c8d6f/ling-he-7nian-di-3hui-lin-shi-hui-51.pdf">第3回大山町議会臨時会（5月1日）</a></p>

<p><a href="/user/filer_public/xx/yy/some-uuid/file.pdf">第4回大山町議会臨時会（5月22日）</a></p>

<p><a href="/gikai/9/m170/a119/">第5回大山町議会定例会（6月3日～6月20日）</a></p>

<p><a href="/user/filer_public/zz/ww/another-uuid/file.pdf">第6回大山町議会臨時会（7月22日）</a></p>

<p><a href="/gikai/9/m170/v137/">第7回大山町議会定例会（9月3日～9月25日）</a></p>

<p><a href="/user/filer_public/aa/bb/uuid/file.pdf">第8回大山町議会臨時会（10月15日）</a></p>

<p><a href="/user/filer_public/cc/dd/uuid/file.pdf">第9回大山町議会臨時会（11月15日）</a></p>

<p><a href="/gikai/9/m170/m135/">第10回大山町議会定例会（12月1日～12月18日）</a></p>
`;

describe("parseYearPage", () => {
  it("臨時会の PDF 直リンクを抽出する", () => {
    const { pdfMeetings } = parseYearPage(YEAR_PAGE_HTML, 2025);
    const rinji = pdfMeetings.filter((m) => m.meetingType === "extraordinary");
    expect(rinji.length).toBe(6);
  });

  it("臨時会の開催日を正しく算出する（1月は翌年）", () => {
    const { pdfMeetings } = parseYearPage(YEAR_PAGE_HTML, 2025);
    const jan = pdfMeetings.find((m) => m.title.includes("1月22日"));
    expect(jan).not.toBeUndefined();
    expect(jan!.heldOn).toBe("2026-01-22");
    expect(jan!.meetingType).toBe("extraordinary");
  });

  it("臨時会の開催日を正しく算出する（5月は同年）", () => {
    const { pdfMeetings } = parseYearPage(YEAR_PAGE_HTML, 2025);
    const may = pdfMeetings.find((m) => m.title.includes("5月1日"));
    expect(may).not.toBeUndefined();
    expect(may!.heldOn).toBe("2025-05-01");
  });

  it("定例会のサブページリンクを抽出する", () => {
    const { subPageLinks } = parseYearPage(YEAR_PAGE_HTML, 2025);
    expect(subPageLinks.length).toBe(4);
  });

  it("定例会サブページリンクの sessionNum が正しい", () => {
    const { subPageLinks } = parseYearPage(YEAR_PAGE_HTML, 2025);
    expect(subPageLinks[0]!.sessionNum).toBe("2");
    expect(subPageLinks[1]!.sessionNum).toBe("5");
    expect(subPageLinks[2]!.sessionNum).toBe("7");
    expect(subPageLinks[3]!.sessionNum).toBe("10");
  });

  it("定例会サブページの URL が絶対 URL になる", () => {
    const { subPageLinks } = parseYearPage(YEAR_PAGE_HTML, 2025);
    expect(subPageLinks[0]!.url).toBe(
      "https://www.daisen.jp/gikai/9/m170/s125/",
    );
  });

  it("臨時会の PDF URL が絶対 URL になる", () => {
    const { pdfMeetings } = parseYearPage(YEAR_PAGE_HTML, 2025);
    for (const m of pdfMeetings) {
      expect(m.pdfUrl).toMatch(/^https:\/\//);
    }
  });
});

const OLD_YEAR_PAGE_HTML = `
<h2>平成25年　会議録</h2>

<p><a href="/system/site/upload/live/14395/atc_1358299204.pdf">第1回臨時会（1月16日）</a></p>

<p><a href="/system/site/upload/live/14395/atc_1363044804.pdf">平成25年第2回定例会第1日（3月4日）</a></p>
<p><a href="/system/site/upload/live/14395/atc_1363131204.pdf">平成25年第2回定例会第2日（3月5日）</a></p>
<p><a href="/system/site/upload/live/14395/atc_1363563604.pdf">平成25年第2回定例会第3日（3月12日）</a></p>

<p><a href="/system/site/upload/live/14395/atc_1367042404.pdf">第3回臨時会（4月30日）</a></p>
`;

describe("parseYearPage（旧形式）", () => {
  it("旧形式の定例会 PDF 直リンクを抽出する", () => {
    const { pdfMeetings } = parseYearPage(OLD_YEAR_PAGE_HTML, 2013);
    const teirei = pdfMeetings.filter((m) => m.meetingType === "plenary");
    expect(teirei.length).toBe(3);
  });

  it("旧形式の定例会タイトルが正しい", () => {
    const { pdfMeetings } = parseYearPage(OLD_YEAR_PAGE_HTML, 2013);
    const teirei = pdfMeetings.filter((m) => m.meetingType === "plenary");
    expect(teirei[0]!.title).toBe("第2回定例会 第1日（3月4日）");
    expect(teirei[1]!.title).toBe("第2回定例会 第2日（3月5日）");
    expect(teirei[2]!.title).toBe("第2回定例会 第3日（3月12日）");
  });

  it("旧形式の定例会の開催日が正しい（3月は翌年）", () => {
    const { pdfMeetings } = parseYearPage(OLD_YEAR_PAGE_HTML, 2013);
    const teirei = pdfMeetings.filter((m) => m.meetingType === "plenary");
    expect(teirei[0]!.heldOn).toBe("2014-03-04");
  });

  it("旧形式の臨時会も抽出できる", () => {
    const { pdfMeetings } = parseYearPage(OLD_YEAR_PAGE_HTML, 2013);
    const rinji = pdfMeetings.filter((m) => m.meetingType === "extraordinary");
    expect(rinji.length).toBe(2);
  });

  it("サブページリンクはない（旧形式）", () => {
    const { subPageLinks } = parseYearPage(OLD_YEAR_PAGE_HTML, 2013);
    expect(subPageLinks.length).toBe(0);
  });
});

const SUB_PAGE_HTML = `
<h2>第2回大山町議会定例会（2月26日～3月13日）</h2>

<p><a href="/user/filer_public/17/8b/178b8557-8127-48e2-8033-2d9f7f5b8f01/ling-he-7nian-di-2hui-ding-li-hui-226.pdf">第1日（2月26日）</a></p>
<p><a href="/user/filer_public/0b/5a/0b5ad55d-9745-4469-9d4f-5fac3a186ef5/ling-he-7nian-di-2hui-ding-li-hui-227.pdf">第2日（2月27日）</a></p>
<p><a href="/user/filer_public/eb/b3/ebb3a845-3b91-4edb-a7f0-f6657bca0090/ling-he-7nian-di-2hui-ding-li-hui-36.pdf">第3日（3月6日）</a></p>
<p><a href="/user/filer_public/35/22/35229a29-e426-455c-bb6e-4a8bf8d4f105/ling-he-7nian-di-2hui-ding-li-hui-37.pdf">第4日（3月7日）</a></p>
<p><a href="/user/filer_public/32/c5/32c5853b-526f-4c70-8846-932c98dcf39f/ling-he-7nian-di-2hui-ding-li-hui-313.pdf">第5日（3月13日）</a></p>
`;

describe("parseSubPage", () => {
  it("日程別 PDF を全件抽出する", () => {
    const result = parseSubPage(SUB_PAGE_HTML, "2", 2025);
    expect(result.length).toBe(5);
  });

  it("タイトルが正しい", () => {
    const result = parseSubPage(SUB_PAGE_HTML, "2", 2025);
    expect(result[0]!.title).toBe("第2回定例会 第1日（2月26日）");
    expect(result[4]!.title).toBe("第2回定例会 第5日（3月13日）");
  });

  it("開催日が正しい（2月は翌年）", () => {
    const result = parseSubPage(SUB_PAGE_HTML, "2", 2025);
    expect(result[0]!.heldOn).toBe("2026-02-26");
  });

  it("開催日が正しい（3月は翌年）", () => {
    const result = parseSubPage(SUB_PAGE_HTML, "2", 2025);
    expect(result[2]!.heldOn).toBe("2026-03-06");
  });

  it("会議種別は plenary", () => {
    const result = parseSubPage(SUB_PAGE_HTML, "2", 2025);
    for (const m of result) {
      expect(m.meetingType).toBe("plenary");
    }
  });

  it("PDF URL が絶対 URL になる", () => {
    const result = parseSubPage(SUB_PAGE_HTML, "2", 2025);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.daisen.jp/user/filer_public/17/8b/178b8557-8127-48e2-8033-2d9f7f5b8f01/ling-he-7nian-di-2hui-ding-li-hui-226.pdf",
    );
  });
});
