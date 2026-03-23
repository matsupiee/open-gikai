import { describe, expect, it } from "vitest";
import { parseYearIndexLinks, parseListPageUrl, parsePdfLinks } from "./list";
import {
  toWarekiSlug,
  fromWarekiSlug,
  parseWarekiYear,
  detectMeetingType,
} from "./shared";

describe("toWarekiSlug", () => {
  it("令和の年度をスラッグに変換する", () => {
    expect(toWarekiSlug(2025)).toBe("r7");
    expect(toWarekiSlug(2024)).toBe("r6");
    expect(toWarekiSlug(2019)).toBe("r1");
  });

  it("平成の年度をスラッグに変換する", () => {
    expect(toWarekiSlug(2018)).toBe("h30");
    expect(toWarekiSlug(2010)).toBe("h22");
  });
});

describe("fromWarekiSlug", () => {
  it("令和スラッグを西暦に変換する", () => {
    expect(fromWarekiSlug("r7")).toBe(2025);
    expect(fromWarekiSlug("r6")).toBe(2024);
    expect(fromWarekiSlug("r1")).toBe(2019);
  });

  it("平成スラッグを西暦に変換する", () => {
    expect(fromWarekiSlug("h30")).toBe(2018);
    expect(fromWarekiSlug("h22")).toBe(2010);
  });

  it("不正なスラッグはnullを返す", () => {
    expect(fromWarekiSlug("x5")).toBeNull();
    expect(fromWarekiSlug("")).toBeNull();
  });
});

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第2回定例会会議録")).toBe(2024);
    expect(parseWarekiYear("令和元年第1回定例会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成22年第1回定例会会議録")).toBe(2010);
    expect(parseWarekiYear("平成30年第4回定例会会議録")).toBe(2018);
    expect(parseWarekiYear("平成元年第1回定例会会議録")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和6年第1回定例会会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和6年第1回臨時会会議録")).toBe("extraordinary");
  });
});

describe("parseYearIndexLinks", () => {
  it("年度別インデックスリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/chosei/gikai/gikairoku/r7_kaigiroku/">令和7年 議会会議録</a></li>
        <li><a href="/chosei/gikai/gikairoku/r6_kaigiroku/">令和6年 議会会議録</a></li>
        <li><a href="/chosei/gikai/gikairoku/h22_kaigiroku/">平成22年 議会会議録</a></li>
      </ul>
    `;

    const result = parseYearIndexLinks(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      slug: "r7",
      url: "https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/r7_kaigiroku/",
    });
    expect(result[1]).toEqual({
      slug: "r6",
      url: "https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/r6_kaigiroku/",
    });
    expect(result[2]).toEqual({
      slug: "h22",
      url: "https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/h22_kaigiroku/",
    });
  });

  it("重複するスラッグを除外する", () => {
    const html = `
      <a href="/chosei/gikai/gikairoku/r6_kaigiroku/">令和6年</a>
      <a href="/chosei/gikai/gikairoku/r6_kaigiroku/">令和6年（重複）</a>
    `;

    const result = parseYearIndexLinks(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseYearIndexLinks(html)).toEqual([]);
  });
});

describe("parseListPageUrl", () => {
  it("年度別会議録一覧ページURLを抽出する", () => {
    const html = `
      <div class="article_body">
        <ul>
          <li><a href="/chosei/gikai/gikairoku/r6_kaigiroku/2064796">令和6年 議会会議録</a></li>
        </ul>
      </div>
    `;

    const result = parseListPageUrl(html, "r6");
    expect(result).toBe(
      "https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/r6_kaigiroku/2064796",
    );
  });

  it("該当するリンクがない場合はnullを返す", () => {
    const html = "<p>No matching links</p>";
    expect(parseListPageUrl(html, "r6")).toBeNull();
  });
});

describe("parsePdfLinks", () => {
  it("PDFリンクを抽出する", () => {
    const html = `
      <h1>令和6年 議会会議録</h1>
      <ul>
        <li><a href="/resource.php?e=56437ba5be12b4df37e12db8e87273f8">令和6年第1回定例会会議録 (PDF 3528KB)</a></li>
        <li><a href="/resource.php?e=abcdef1234567890abcdef1234567890">令和6年第2回定例会会議録 (PDF 1010KB)</a></li>
        <li><a href="/resource.php?e=1111222233334444555566667777888899">令和6年第1回臨時会会議録 (PDF 518KB)</a></li>
      </ul>
    `;

    const result = parsePdfLinks(html, "r6");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和6年第1回定例会会議録",
      pdfUrl:
        "https://www.town.ashikita.lg.jp/resource.php?e=56437ba5be12b4df37e12db8e87273f8",
      meetingType: "plenary",
      year: 2024,
      yearSlug: "r6",
    });
    expect(result[1]!.title).toBe("令和6年第2回定例会会議録");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[2]!.title).toBe("令和6年第1回臨時会会議録");
    expect(result[2]!.meetingType).toBe("extraordinary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>No PDF links</p>";
    expect(parsePdfLinks(html, "r6")).toEqual([]);
  });

  it("不正な年号スラッグの場合は空配列を返す", () => {
    const html = `<a href="/resource.php?e=abc">test (PDF 100KB)</a>`;
    expect(parsePdfLinks(html, "x99")).toEqual([]);
  });

  it("リンクテキストからファイルサイズ情報を除去する", () => {
    const html = `
      <a href="/resource.php?e=abc123">令和6年第1回定例会会議録 (PDF 3,528KB)</a>
    `;

    const result = parsePdfLinks(html, "r6");
    expect(result[0]!.title).toBe("令和6年第1回定例会会議録");
  });
});
