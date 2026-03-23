import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parseYearPage } from "./list";
import {
  detectMeetingType,
  parseWarekiYear,
  parseWarekiNendo,
  nendoToWarekiLabel,
} from "./shared";

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和6年")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成31年")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("parseWarekiNendo", () => {
  it("令和の年度を変換する", () => {
    expect(parseWarekiNendo("令和6年第1回定例会")).toBe(2024);
  });

  it("平成31年・令和元年のラベルを変換する", () => {
    expect(parseWarekiNendo("平成31年・令和元年")).toBe(2019);
  });

  it("平成の年度を変換する", () => {
    expect(parseWarekiNendo("平成28年")).toBe(2016);
  });
});

describe("nendoToWarekiLabel", () => {
  it("令和2年以降を変換する", () => {
    expect(nendoToWarekiLabel(2024)).toEqual(["令和6年"]);
    expect(nendoToWarekiLabel(2025)).toEqual(["令和7年"]);
  });

  it("令和元年/平成31年を両方返す", () => {
    expect(nendoToWarekiLabel(2019)).toEqual(["令和元年", "平成31年"]);
  });

  it("平成を変換する", () => {
    expect(nendoToWarekiLabel(2016)).toEqual(["平成28年"]);
  });
});

describe("parseYearPageLinks", () => {
  it("トップページから年度ページリンクを抽出する", () => {
    const html = `
      <ul class="category_end">
        <li><a href="https://www.town.ando.nara.jp/0000003897.html">令和7年</a></li>
        <li><a href="https://www.town.ando.nara.jp/0000003757.html">令和6年</a></li>
        <li><a href="https://www.town.ando.nara.jp/0000002302.html">平成31年・令和元年</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      nendo: 2025,
      url: "https://www.town.ando.nara.jp/0000003897.html",
      articleId: "3897",
    });
    expect(result[1]).toEqual({
      nendo: 2024,
      url: "https://www.town.ando.nara.jp/0000003757.html",
      articleId: "3757",
    });
    expect(result[2]).toEqual({
      nendo: 2019,
      url: "https://www.town.ando.nara.jp/0000002302.html",
      articleId: "2302",
    });
  });

  it("category_end 外のリンクは抽出しない", () => {
    const html = `
      <ul class="other_list">
        <li><a href="https://www.town.ando.nara.jp/0000003862.html">閲覧にあたっての注意事項</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toEqual([]);
  });

  it("和暦が解析できないリンクはスキップする", () => {
    const html = `
      <ul class="category_end">
        <li><a href="https://www.town.ando.nara.jp/0000003862.html">閲覧にあたっての注意事項</a></li>
        <li><a href="https://www.town.ando.nara.jp/0000003757.html">令和6年</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.nendo).toBe(2024);
  });
});

describe("parseYearPage", () => {
  it("年度ページから会議ごとの PDF セッションを抽出する", () => {
    const html = `
      <div class="mol_attachfileblock block_index_1">
        <p class="mol_attachfileblock_title">第1回定例会</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000003/3757/R6.3.4esturan.pdf"><img src="images/pdf.gif" alt="" width="22" height="24" class="icon" >第1日（3月4日）</a></li>
          <li><a href="./cmsfiles/contents/0000003/3757/20240305.pdf"><img src="images/pdf.gif" alt="" width="22" height="24" class="icon" >第2日（3月5日）</a></li>
          <li><a href="./cmsfiles/contents/0000003/3757/R6.3.22.pdf"><img src="images/pdf.gif" alt="" width="22" height="24" class="icon" >第3日（3月22日）</a></li>
        </ul>
      </div>
      <div class="mol_attachfileblock block_index_2">
        <p class="mol_attachfileblock_title">第1回臨時会</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000003/3757/R6.4.30.pdf"><img src="images/pdf.gif" alt="" width="22" height="24" class="icon" >第1日（4月30日）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, "3757", 2024);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      title: "第1回定例会 第1日（3月4日）",
      heldOn: "2025-03-04",
      pdfUrl: "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/R6.3.4esturan.pdf",
      meetingType: "plenary",
      articleId: "3757",
    });
    expect(result[1]).toEqual({
      title: "第1回定例会 第2日（3月5日）",
      heldOn: "2025-03-05",
      pdfUrl: "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/20240305.pdf",
      meetingType: "plenary",
      articleId: "3757",
    });
    expect(result[2]).toEqual({
      title: "第1回定例会 第3日（3月22日）",
      heldOn: "2025-03-22",
      pdfUrl: "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/R6.3.22.pdf",
      meetingType: "plenary",
      articleId: "3757",
    });
    expect(result[3]).toEqual({
      title: "第1回臨時会 第1日（4月30日）",
      heldOn: "2024-04-30",
      pdfUrl: "https://www.town.ando.nara.jp/cmsfiles/contents/0000003/3757/R6.4.30.pdf",
      meetingType: "extraordinary",
      articleId: "3757",
    });
  });

  it("日付パターンを含まないリンクはスキップする", () => {
    const html = `
      <div class="mol_attachfileblock">
        <p class="mol_attachfileblock_title">第1回定例会</p>
        <ul>
          <li><a href="./something.pdf"><img src="images/pdf.gif" alt="" class="icon" >議事日程</a></li>
          <li><a href="./session.pdf"><img src="images/pdf.gif" alt="" class="icon" >第1日（3月4日）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, "3757", 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会 第1日（3月4日）");
  });

  it("mol_attachfileblock がない場合は空配列を返す", () => {
    const html = "<div><p>会議録はありません</p></div>";

    const result = parseYearPage(html, "3757", 2024);
    expect(result).toEqual([]);
  });

  it("6月〜12月の開催は年度と同じ年になる", () => {
    const html = `
      <div class="mol_attachfileblock">
        <p class="mol_attachfileblock_title">第2回定例会</p>
        <ul>
          <li><a href="./test.pdf"><img src="images/pdf.gif" alt="" class="icon" >第1日（6月5日）</a></li>
          <li><a href="./test2.pdf"><img src="images/pdf.gif" alt="" class="icon" >第2日（12月17日）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, "3757", 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2024-06-05");
    expect(result[1]!.heldOn).toBe("2024-12-17");
  });

  it("絶対URLのPDFリンクをそのまま使う", () => {
    const html = `
      <div class="mol_attachfileblock">
        <p class="mol_attachfileblock_title">第1回定例会</p>
        <ul>
          <li><a href="https://www.town.ando.nara.jp/cmsfiles/test.pdf"><img src="images/pdf.gif" alt="" class="icon" >第1日（3月4日）</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, "3757", 2024);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.town.ando.nara.jp/cmsfiles/test.pdf");
  });
});
