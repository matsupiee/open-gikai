import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import {
  buildDocumentUrl,
  buildListUrl,
  detectMeetingType,
  extractHeldOnFromText,
  normalizeYearLabel,
  parseHeadingYear,
  toHalfWidth,
} from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("令和７年３月４日")).toBe("令和7年3月4日");
  });
});

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("第一回定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("第一回臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("build urls", () => {
  it("一覧URLをそのまま解決する", () => {
    expect(buildListUrl("http://www.vill.aoki.nagano.jp/gikai03.html")).toBe(
      "http://www.vill.aoki.nagano.jp/gikai03.html",
    );
  });

  it("PDF 相対URLを絶対URLに変換する", () => {
    expect(
      buildDocumentUrl("/asset/00032/gyousei/soumuka/gikai/deta/gikai07-1.pdf"),
    ).toBe(
      "https://www.vill.aoki.nagano.jp/asset/00032/gyousei/soumuka/gikai/deta/gikai07-1.pdf",
    );
  });
});

describe("parseHeadingYear / normalizeYearLabel", () => {
  it("令和の見出しを解釈する", () => {
    expect(parseHeadingYear("令和7年")).toBe(2025);
    expect(normalizeYearLabel("令和7年")).toBe("令和7年");
  });

  it("令和元年（平成31年）を 2019 年として扱う", () => {
    expect(parseHeadingYear("令和元年（平成31年）")).toBe(2019);
    expect(normalizeYearLabel("令和元年（平成31年）")).toBe("令和元年");
  });

  it("平成の見出しを解釈する", () => {
    expect(parseHeadingYear("平成30年")).toBe(2018);
    expect(normalizeYearLabel("平成30年")).toBe("平成30年");
  });
});

describe("extractHeldOnFromText", () => {
  it("空白入りの令和日付を抽出する", () => {
    expect(
      extractHeldOnFromText("令 和 ７ 年 ３ 月 ４ 日 開 会 令 和 ７ 年 ３ 月 14 日 閉 会"),
    ).toBe("2025-03-04");
  });

  it("空白入りの平成日付を抽出する", () => {
    expect(
      extractHeldOnFromText("平 成 3 1 年 ３ 月 ６ 日 開 会 平 成 3 1 年 ３ 月 1 9 日 閉 会"),
    ).toBe("2019-03-06");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOnFromText("青木村議会会議録")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("議会議事録セクションの PDF のみを抽出する", () => {
    const html = `
      <h4><span>議会議事録</span></h4>
      <h5><span>令和7年</span></h5>
      <p><a href="/asset/00032/gyousei/soumuka/gikai/deta/gikai07-1.pdf">・第一回定例会</a></p>
      <p><a href="/asset/00032/gyousei/soumuka/gikai/deta/gikai07-rinzi1.pdf">・第一回臨時会</a></p>
      <h5><span>令和元年（平成31年）</span></h5>
      <p><a href="/asset/00032/gyousei/soumuka/gikai/deta/gikai31-1.pdf">・第一回定例会</a></p>
      <h6><span>議会一般質問（音声）</span></h6>
      <h5><span>令和7年</span></h5>
      <p><a href="/asset/00032/gyousei/soumuka/gikai/deta/R07T1_1Kutsukake.MP3">①沓掛 計三</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      title: "令和7年 第一回定例会",
      pdfUrl:
        "https://www.vill.aoki.nagano.jp/asset/00032/gyousei/soumuka/gikai/deta/gikai07-1.pdf",
      meetingType: "plenary",
      headingYear: 2025,
    });
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[2]!.title).toBe("令和元年 第一回定例会");
    expect(result[2]!.headingYear).toBe(2019);
  });

  it("議会議事録セクション外のリンクを無視する", () => {
    const html = `
      <h4><span>政務活動費報告</span></h4>
      <p><a href="/asset/00032/gyousei/soumuka/gikai/deta/seimukatsudouhi_R07_1.pdf">令和７年度報告書</a></p>
      <h4><span>議会議事録</span></h4>
      <h5><span>平成30年</span></h5>
      <p><a href="/asset/00032/gyousei/soumuka/gikai/deta/gikai30-4.pdf">・第四回定例会</a></p>
    `;

    expect(parseListPage(html)).toEqual([
      {
        title: "平成30年 第四回定例会",
        pdfUrl:
          "https://www.vill.aoki.nagano.jp/asset/00032/gyousei/soumuka/gikai/deta/gikai30-4.pdf",
        meetingType: "plenary",
        headingYear: 2018,
      },
    ]);
  });
});
