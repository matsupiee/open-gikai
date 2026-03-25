import { describe, expect, it } from "vitest";
import { detectMeetingType, parseWarekiYear } from "./shared";
import {
  extractYearFromTitle,
  parseListHtml,
  parseTotalHits,
} from "./list";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年9月定例会")).toBe(2025);
    expect(parseWarekiYear("令和元年6月定例会")).toBe(2019);
    expect(parseWarekiYear("令和1年6月定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成17年3月定例会")).toBe(2005);
    expect(parseWarekiYear("平成元年3月定例会")).toBe(1989);
  });

  it("昭和の年を変換する", () => {
    expect(parseWarekiYear("昭和62年3月定例会")).toBe(1987);
    expect(parseWarekiYear("昭和元年3月定例会")).toBe(1926);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2025年9月定例会")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和7年9月定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年5月臨時会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("令和7年総務委員会")).toBe("committee");
  });
});

describe("parseTotalHits", () => {
  it("総件数を抽出する", () => {
    const html = "975件の日程がヒットしました。";
    expect(parseTotalHits(html)).toBe(975);
  });

  it("マッチしない場合は 0 を返す", () => {
    expect(parseTotalHits("<p>No results</p>")).toBe(0);
  });
});

describe("parseListHtml", () => {
  it("HTML から FINO・KGNO・会議名を抽出する", () => {
    const html = `
      令和　７年　９月定例会,<A HREF="voiweb.exe?ACT=200&KTYP=0,1,2,3&KGTP=1,2&SORT=1&PAGE=1&HIT=975&KGNO=220&FINO=973" TARGET="HLD_WIN">10月03日-01号</A>
      令和　６年　１２月定例会,<A HREF="voiweb.exe?ACT=200&KTYP=0,1,2,3&KGTP=1,2&SORT=1&PAGE=1&HIT=975&KGNO=219&FINO=970" TARGET="HLD_WIN">12月16日-03号</A>
    `;

    const result = parseListHtml(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.fino).toBe(973);
    expect(result[0]!.kgno).toBe(220);
    expect(result[0]!.dateText).toBe("10月03日-01号");
    expect(result[0]!.detailUrl).toBe(
      "https://www.city.yatsushiro.kumamoto.jp/VOICES/CGI/voiweb.exe?ACT=200&KGNO=220&FINO=973",
    );

    expect(result[1]!.fino).toBe(970);
    expect(result[1]!.kgno).toBe(219);
    expect(result[1]!.dateText).toBe("12月16日-03号");
  });

  it("FINO のないリンクは無視する", () => {
    const html = `
      <A HREF="voiweb.exe?ACT=1">簡易検索</A>
      <A HREF="voiweb.exe?ACT=100">一覧</A>
    `;
    expect(parseListHtml(html)).toHaveLength(0);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseListHtml("<p>No links</p>")).toHaveLength(0);
  });
});

describe("extractYearFromTitle", () => {
  it("令和の会議名から西暦年を返す", () => {
    expect(extractYearFromTitle("令和　７年　９月定例会", "10月03日-01号")).toBe(2025);
    expect(extractYearFromTitle("令和元年6月定例会", "")).toBe(2019);
  });

  it("平成の会議名から西暦年を返す", () => {
    expect(extractYearFromTitle("平成17年3月定例会", "")).toBe(2005);
  });

  it("昭和の会議名から西暦年を返す", () => {
    expect(extractYearFromTitle("昭和62年3月定例会", "")).toBe(1987);
  });

  it("マッチしない場合は null を返す", () => {
    expect(extractYearFromTitle("会議録", "")).toBeNull();
  });
});
