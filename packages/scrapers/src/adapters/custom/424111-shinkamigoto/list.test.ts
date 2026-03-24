import { describe, expect, it } from "vitest";
import {
  convertWarekiToWesternYear,
  detectMeetingType,
  parseDateFromLinkText,
  toHalfWidth,
} from "./shared";
import {
  extractMeetingTitle,
  parseEidList,
  parseYearPage,
} from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertWarekiToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertWarekiToWesternYear("令和6年本会議　会議録")).toBe(2024);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertWarekiToWesternYear("令和６年本会議　会議録")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertWarekiToWesternYear("令和元年本会議　会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertWarekiToWesternYear("平成30年本会議　会議録")).toBe(2018);
    expect(convertWarekiToWesternYear("平成18年本会議　会議録")).toBe(2006);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第１回定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第１回臨時会")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("常任委員会")).toBe("committee");
  });
});

describe("parseDateFromLinkText", () => {
  it("R形式の日付をパースする（単日）", () => {
    expect(parseDateFromLinkText("第１回臨時会（R6.1.31）[0.56MB]", 2024)).toBe(
      "2024-01-31",
    );
  });

  it("R形式の日付をパースする（期間）", () => {
    expect(parseDateFromLinkText("第１回定例会（R6.3.5～15）[3.95MB]", 2024)).toBe(
      "2024-03-05",
    );
  });

  it("月・日が1桁の場合もゼロパディングする", () => {
    expect(parseDateFromLinkText("第２回定例会（R6.6.18～20）[3.49MB]", 2024)).toBe(
      "2024-06-18",
    );
  });

  it("パターンがない場合はnullを返す", () => {
    expect(parseDateFromLinkText("第１回定例会", 2024)).toBeNull();
  });
});

describe("extractMeetingTitle", () => {
  it("ファイルサイズ情報と日付括弧を除去する", () => {
    expect(extractMeetingTitle("第１回臨時会（R6.1.31）[0.56MB]")).toBe("第１回臨時会");
  });

  it("期間形式の日付括弧も除去する", () => {
    expect(extractMeetingTitle("第１回定例会（R6.3.5～15）[3.95MB]")).toBe("第１回定例会");
  });

  it("括弧なしのタイトルはそのまま返す", () => {
    expect(extractMeetingTitle("第１回定例会")).toBe("第１回定例会");
  });
});

describe("parseEidList", () => {
  it("一覧ページから eid と年を抽出する", () => {
    const html = `
      <a href="goto_chosei_full.php?eid=06571&r=4&wcid=l00002x4">令和６年本会議　会議録</a>
      <a href="goto_chosei_full.php?eid=05984&r=4&wcid=l00002x4">令和５年本会議　会議録</a>
    `;

    const result = parseEidList(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.eid).toBe("06571");
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.eid).toBe("05984");
    expect(result[1]!.year).toBe(2023);
  });

  it("和暦を含まないリンクはスキップする", () => {
    const html = `
      <a href="goto_chosei_full.php?eid=99999&r=4&wcid=l00002x4">その他のリンク</a>
      <a href="goto_chosei_full.php?eid=06571&r=4&wcid=l00002x4">令和６年本会議　会議録</a>
    `;

    const result = parseEidList(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.eid).toBe("06571");
  });

  it("平成の年も変換する", () => {
    const html = `
      <a href="goto_chosei_full.php?eid=00428&r=4&wcid=l00002x4">平成18年本会議　会議録</a>
    `;

    const result = parseEidList(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2006);
  });

  it("リンクがない場合は空配列を返す", () => {
    expect(parseEidList("<p>リンクなし</p>")).toEqual([]);
  });
});

describe("parseYearPage", () => {
  it("年度別ページから PDF リンクを抽出する", () => {
    const html = `
      <a href="cmd/dlfile.php?entryname=benri&entryid=06571&fileid=00000016&/kaigiroku.pdf">
        第１回臨時会（R6.1.31）[0.56MB]
      </a>
      <a href="cmd/dlfile.php?entryname=benri&entryid=06571&fileid=00000017&/kaigiroku2.pdf">
        第１回定例会（R6.3.5～15）[3.95MB]
      </a>
    `;

    const result = parseYearPage(html, 2024, "令和6年");

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年第１回臨時会");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.heldOn).toBe("2024-01-31");
    expect(result[0]!.pdfUrl).toContain("cmd/dlfile.php");

    expect(result[1]!.title).toBe("令和6年第１回定例会");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[1]!.heldOn).toBe("2024-03-05");
  });

  it("dlfile.php を含まないリンクはスキップする", () => {
    const html = `
      <a href="/other/page.html">その他のリンク</a>
      <a href="cmd/dlfile.php?entryname=benri&entryid=06571&fileid=00000016&/test.pdf">
        第１回臨時会（R6.1.31）[0.56MB]
      </a>
    `;

    const result = parseYearPage(html, 2024, "令和6年");
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    expect(parseYearPage("<p>会議録なし</p>", 2024, "令和6年")).toEqual([]);
  });
});
