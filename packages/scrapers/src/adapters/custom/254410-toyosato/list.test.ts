import { describe, expect, it } from "vitest";
import {
  isMeetingMinutes,
  parseIndexPage,
  parseDetailPage,
  extractYearFromHeldOn,
} from "./list";
import {
  buildHeldOn,
  detectMeetingType,
  extractMonthFromTitle,
  extractYearFromTitle,
  extractHeldOnFromPdf,
} from "./shared";

describe("extractYearFromTitle", () => {
  it("令和6年を2024に変換する", () => {
    expect(extractYearFromTitle("令和6年3月豊郷町議会定例会")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("令和元年豊郷町議会臨時会")).toBe(2019);
  });

  it("令和3年を2021に変換する", () => {
    expect(extractYearFromTitle("令和3年12月豊郷町議会定例会")).toBe(2021);
  });

  it("平成31年を2019に変換する", () => {
    expect(extractYearFromTitle("平成31年豊郷町議会定例会")).toBe(2019);
  });

  it("平成26年を2014に変換する", () => {
    expect(extractYearFromTitle("平成26年12月豊郷町議会定例会")).toBe(2014);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("豊郷町議会定例会")).toBeNull();
  });
});

describe("extractMonthFromTitle", () => {
  it("3月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年3月豊郷町議会定例会")).toBe(3);
  });

  it("12月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年12月豊郷町議会定例会")).toBe(12);
  });

  it("臨時会で月なしの場合は null を返す", () => {
    expect(extractMonthFromTitle("令和6年第1回豊郷町臨時会")).toBeNull();
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
    expect(detectMeetingType("令和6年3月豊郷町議会定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和6年第1回豊郷町臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("extractHeldOnFromPdf", () => {
  it("YYYYMMDD.pdf 形式のファイル名から日付を抽出する", () => {
    expect(
      extractHeldOnFromPdf(
        "https://www.town.toyosato.shiga.jp/cmsfiles/contents/0000003/3781/20200305.pdf",
        "3月5日　会議録",
        "令和2年3月豊郷町議会定例会",
      ),
    ).toBe("2020-03-05");
  });

  it("リンクテキストの月日と sessionTitle の年から日付を組み立てる", () => {
    expect(
      extractHeldOnFromPdf(
        "https://www.town.toyosato.shiga.jp/cmsfiles/contents/0000003/3781/1208kaigiroku.pdf",
        "12月8日会議録",
        "平成26年12月豊郷町議会定例会",
      ),
    ).toBe("2014-12-08");
  });

  it("PDF ファイル名が非標準でリンクテキストにも月日がない場合は月のみ推定する", () => {
    expect(
      extractHeldOnFromPdf(
        "https://www.town.toyosato.shiga.jp/cmsfiles/contents/0000003/3781/kaigiroku.pdf",
        "会議録",
        "令和6年3月豊郷町議会定例会",
      ),
    ).toBe("2024-03-01");
  });
});

describe("isMeetingMinutes", () => {
  it("会議録は true", () => {
    expect(isMeetingMinutes("3月6日　会議録")).toBe(true);
  });

  it("会議録（テキストに会議録が含まれる）は true", () => {
    expect(isMeetingMinutes("12月8日会議録")).toBe(true);
  });

  it("会期日程は false", () => {
    expect(isMeetingMinutes("会期日程")).toBe(false);
  });

  it("一般質問事項は false", () => {
    expect(isMeetingMinutes("一般質問事項")).toBe(false);
  });

  it("採決結果は false", () => {
    expect(isMeetingMinutes("採決結果")).toBe(false);
  });

  it("単なる「日程」は false", () => {
    expect(isMeetingMinutes("日程")).toBe(false);
  });

  it("「定例会」を含む月日テキスト（第1回定例会　3月5日）は true", () => {
    expect(isMeetingMinutes("第1回定例会　3月5日")).toBe(true);
  });

  it("「臨時会」を含む月日テキストは true", () => {
    expect(isMeetingMinutes("第2回臨時会　5月1日")).toBe(true);
  });

  it("「会議録」なしの月日のみのテキスト（3月5日）は true", () => {
    expect(isMeetingMinutes("3月5日")).toBe(true);
  });
});

describe("parseIndexPage", () => {
  it("10桁IDの会議詳細ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/0000003781.html">令和2年3月豊郷町議会定例会</a></li>
        <li><a href="/0000003782.html">令和2年6月豊郷町議会定例会</a></li>
        <li><a href="/0000003783.html">令和2年9月豊郷町議会定例会</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.url).toBe("https://www.town.toyosato.shiga.jp/0000003781.html");
    expect(result[0]!.title).toBe("令和2年3月豊郷町議会定例会");
    expect(result[1]!.url).toBe("https://www.town.toyosato.shiga.jp/0000003782.html");
    expect(result[2]!.url).toBe("https://www.town.toyosato.shiga.jp/0000003783.html");
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="/0000003781.html">令和2年3月豊郷町議会定例会</a>
      <a href="/0000003781.html">令和2年3月豊郷町議会定例会（再掲）</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
  });

  it("10桁以外のリンクは無視する", () => {
    const html = `
      <a href="/top.html">トップ</a>
      <a href="/category/32-5-0-0-0-0-0-0-0-0.html">会議録一覧</a>
      <a href="/0000003781.html">令和2年3月豊郷町議会定例会</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://www.town.toyosato.shiga.jp/0000003781.html");
  });

  it("絶対 URL のリンクも抽出する", () => {
    const html = `
      <a href="https://www.town.toyosato.shiga.jp/0000003781.html">令和2年3月豊郷町議会定例会</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://www.town.toyosato.shiga.jp/0000003781.html");
  });
});

describe("parseDetailPage", () => {
  const detailPageUrl = "https://www.town.toyosato.shiga.jp/0000003781.html";

  it("会議録 PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/cmsfiles/contents/0000003/3781/nittei.pdf">会期日程</a></li>
        <li><a href="/cmsfiles/contents/0000003/3781/ippan.pdf">一般質問事項</a></li>
        <li><a href="/cmsfiles/contents/0000003/3781/20200305.pdf">3月5日　会議録</a></li>
        <li><a href="/cmsfiles/contents/0000003/3781/20200306.pdf">3月6日　会議録</a></li>
      </ul>
    `;

    const result = parseDetailPage(html, "令和2年3月豊郷町議会定例会", detailPageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionTitle).toBe("令和2年3月豊郷町議会定例会");
    expect(result[0]!.pdfUrl).toBe("https://www.town.toyosato.shiga.jp/cmsfiles/contents/0000003/3781/20200305.pdf");
    expect(result[0]!.linkText).toBe("3月5日 会議録");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2020-03-05");
    expect(result[0]!.detailPageUrl).toBe(detailPageUrl);

    expect(result[1]!.pdfUrl).toBe("https://www.town.toyosato.shiga.jp/cmsfiles/contents/0000003/3781/20200306.pdf");
    expect(result[1]!.heldOn).toBe("2020-03-06");
  });

  it("採決結果は除外する", () => {
    const html = `
      <ul>
        <li><a href="/cmsfiles/contents/0000003/3781/saketsu.pdf">採決結果</a></li>
        <li><a href="/cmsfiles/contents/0000003/3781/20200305.pdf">3月5日　会議録</a></li>
      </ul>
    `;

    const result = parseDetailPage(html, "令和2年3月豊郷町議会定例会", detailPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("3月5日 会議録");
  });

  it("臨時会を correctly に抽出する", () => {
    const html = `
      <ul>
        <li><a href="/cmsfiles/contents/0000003/3781/20200501.pdf">5月1日　会議録</a></li>
      </ul>
    `;

    const result = parseDetailPage(html, "令和2年第1回豊郷町臨時会", detailPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2020-05-01");
  });

  it("古い形式のファイル名（MMDD形式）でリンクテキストから日付を取得する", () => {
    const html = `
      <ul>
        <li><a href="/cmsfiles/contents/0000003/3781/1208kaigiroku.pdf">12月8日会議録</a></li>
      </ul>
    `;

    const result = parseDetailPage(html, "平成26年12月豊郷町議会定例会", detailPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2014-12-08");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li>会議録はありません</li>
      </ul>
    `;

    const result = parseDetailPage(html, "令和2年3月豊郷町議会定例会", detailPageUrl);

    expect(result).toHaveLength(0);
  });
});

describe("extractYearFromHeldOn", () => {
  it("YYYY-MM-DD から年を抽出する", () => {
    expect(extractYearFromHeldOn("2024-03-01")).toBe(2024);
  });

  it("null の場合は null を返す", () => {
    expect(extractYearFromHeldOn(null)).toBeNull();
  });

  it("不正なフォーマットの場合は null を返す", () => {
    expect(extractYearFromHeldOn("invalid")).toBeNull();
  });
});
