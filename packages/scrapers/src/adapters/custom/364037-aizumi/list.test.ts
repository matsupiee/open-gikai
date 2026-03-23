import { describe, expect, it } from "vitest";
import { parseYearPage, parseSessionFromLinkText } from "./list";
import { buildYearPageUrl, parseWarekiYear, detectMeetingType } from "./shared";

describe("buildYearPageUrl", () => {
  it("令和年の URL を生成する", () => {
    expect(buildYearPageUrl(2025)).toBe(
      "https://www.town.aizumi.lg.jp/gikai/minutes/r7.html",
    );
    expect(buildYearPageUrl(2019)).toBe(
      "https://www.town.aizumi.lg.jp/gikai/minutes/r1.html",
    );
  });

  it("平成年の URL を生成する", () => {
    expect(buildYearPageUrl(2018)).toBe(
      "https://www.town.aizumi.lg.jp/gikai/minutes/h30.html",
    );
    expect(buildYearPageUrl(2013)).toBe(
      "https://www.town.aizumi.lg.jp/gikai/minutes/h25.html",
    );
  });

  it("対象外の年は null を返す", () => {
    expect(buildYearPageUrl(2012)).toBeNull();
    expect(buildYearPageUrl(2000)).toBeNull();
  });
});

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年")).toBe(2025);
    expect(parseWarekiYear("令和元年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年")).toBe(2018);
    expect(parseWarekiYear("平成25年")).toBe(2013);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
    expect(parseWarekiYear("")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("定例会")).toBe("plenary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });
});

describe("parseSessionFromLinkText", () => {
  it("令和の定例会リンクテキストをパースする", () => {
    const result = parseSessionFromLinkText(
      "令和7年第4回(12月)定例会会議録[PDF：923KB]",
      "/_files/00654074/r7_4_kaigiroku.pdf",
      2025,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年第4回定例会");
    expect(result!.heldOn).toBe("2025-12-01");
    expect(result!.pdfUrl).toBe(
      "https://www.town.aizumi.lg.jp/_files/00654074/r7_4_kaigiroku.pdf",
    );
    expect(result!.meetingType).toBe("plenary");
    expect(result!.pdfPath).toBe("/_files/00654074/r7_4_kaigiroku.pdf");
  });

  it("平成の定例会リンクテキストをパースする", () => {
    const result = parseSessionFromLinkText(
      "平成25年第4回(12月)定例会会議録[PDF：500KB]",
      "/_files/00041799/h25_4_kaigiroku.pdf",
      2013,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("平成25年第4回定例会");
    expect(result!.heldOn).toBe("2013-12-01");
    expect(result!.meetingType).toBe("plenary");
  });

  it("年が一致しない場合は null を返す", () => {
    const result = parseSessionFromLinkText(
      "令和7年第4回(12月)定例会会議録[PDF：923KB]",
      "/_files/00654074/r7_4_kaigiroku.pdf",
      2024,
    );

    expect(result).toBeNull();
  });

  it("会議録テキストに一致しない場合は null を返す", () => {
    const result = parseSessionFromLinkText(
      "議事日程一覧",
      "/some/file.pdf",
      2025,
    );

    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("年別ページから PDF リンクを抽出する", () => {
    const html = `
      <div id="main">
        <h2>令和7年会議録</h2>
        <ul>
          <li><a href="/_files/00654074/r7_4_kaigiroku.pdf">令和7年第4回(12月)定例会会議録[PDF：923KB]</a></li>
          <li><a href="/_files/00640000/r7_3_kaigiroku.pdf">令和7年第3回(9月)定例会会議録[PDF：800KB]</a></li>
          <li><a href="/_files/00630000/r7_2_kaigiroku.pdf">令和7年第2回(6月)定例会会議録[PDF：700KB]</a></li>
          <li><a href="/_files/00620000/r7_1_kaigiroku.pdf">令和7年第1回(3月)定例会会議録[PDF：600KB]</a></li>
        </ul>
      </div>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      title: "令和7年第4回定例会",
      heldOn: "2025-12-01",
      pdfUrl:
        "https://www.town.aizumi.lg.jp/_files/00654074/r7_4_kaigiroku.pdf",
      meetingType: "plenary",
      pdfPath: "/_files/00654074/r7_4_kaigiroku.pdf",
    });
    expect(result[1]!.heldOn).toBe("2025-09-01");
    expect(result[2]!.heldOn).toBe("2025-06-01");
    expect(result[3]!.heldOn).toBe("2025-03-01");
  });

  it("会議録以外の PDF リンクを除外する", () => {
    const html = `
      <div>
        <a href="/_files/001/doc.pdf">議事日程[PDF：100KB]</a>
        <a href="/_files/002/r7_1_kaigiroku.pdf">令和7年第1回(3月)定例会会議録[PDF：600KB]</a>
      </div>
    `;

    const result = parseYearPage(html, 2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年第1回定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ会議録は掲載されていません。</p>";
    expect(parseYearPage(html, 2025)).toEqual([]);
  });

  it("異なる年のリンクを除外する", () => {
    const html = `
      <a href="/_files/001/r6_1_kaigiroku.pdf">令和6年第1回(3月)定例会会議録[PDF：600KB]</a>
    `;

    const result = parseYearPage(html, 2025);
    expect(result).toEqual([]);
  });
});
