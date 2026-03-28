import { describe, expect, it } from "vitest";
import {
  extractYearFromHeldOn,
  isMeetingMinutes,
  parseDetailPage,
  parseIndexPage,
} from "./list";
import {
  buildHeldOn,
  detectMeetingType,
  extractHeldOnFromPdf,
  extractMonthFromTitle,
  extractYearFromTitle,
} from "./shared";

describe("extractYearFromTitle", () => {
  it("令和6年を2024に変換する", () => {
    expect(extractYearFromTitle("令和6年第2回（3月）定例会会議録")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("令和元年第4回（9月）定例会会議録")).toBe(2019);
  });

  it("平成31年を2019に変換する", () => {
    expect(extractYearFromTitle("平成31年第1回（3月）定例会会議録")).toBe(2019);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("定例会会議録")).toBeNull();
  });
});

describe("extractMonthFromTitle", () => {
  it("月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年第2回（3月）定例会会議録")).toBe(3);
  });

  it("日付がある場合も月を抽出する", () => {
    expect(extractMonthFromTitle("令和7年第3回（5月14日）臨時会会議録")).toBe(5);
  });
});

describe("buildHeldOn", () => {
  it("年月から YYYY-MM-01 を組み立てる", () => {
    expect(buildHeldOn(2024, 3)).toBe("2024-03-01");
  });

  it("月が null なら null を返す", () => {
    expect(buildHeldOn(2024, null)).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和6年第2回（3月）定例会会議録")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和7年第3回（5月14日）臨時会会議録")).toBe(
      "extraordinary",
    );
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("予算特別委員会会議録")).toBe("committee");
  });
});

describe("extractHeldOnFromPdf", () => {
  it("PDF ファイル名の YYYYMMDD から日付を抽出する", () => {
    expect(
      extractHeldOnFromPdf(
        "https://www.town.shiga-hino.lg.jp/cmsfiles/contents/0000007/7861/20240308kaigiroku.pdf",
        "第3日(3月8日)",
        "令和6年第2回（3月）定例会会議録",
      ),
    ).toBe("2024-03-08");
  });

  it("ファイル名が非標準ならリンクテキストから日付を抽出する", () => {
    expect(
      extractHeldOnFromPdf(
        "https://www.town.shiga-hino.lg.jp/cmsfiles/contents/0000007/7861/kaigiroku.pdf",
        "第3日(3月8日)",
        "令和6年第2回（3月）定例会会議録",
      ),
    ).toBe("2024-03-08");
  });

  it("日が取れない場合はタイトルの年月で補完する", () => {
    expect(
      extractHeldOnFromPdf(
        "https://www.town.shiga-hino.lg.jp/cmsfiles/contents/0000007/7861/r6-kaigiroku.pdf",
        "会議録",
        "令和6年第2回（3月）定例会会議録",
      ),
    ).toBe("2024-03-01");
  });
});

describe("isMeetingMinutes", () => {
  it("kaigiroku.pdf は true", () => {
    expect(
      isMeetingMinutes(
        "第1日(3月1日)",
        "https://www.town.shiga-hino.lg.jp/cmsfiles/contents/0000007/7861/20240301kaigiroku.pdf",
      ),
    ).toBe(true);
  });

  it("目次は false", () => {
    expect(
      isMeetingMinutes(
        "目次",
        "https://www.town.shiga-hino.lg.jp/cmsfiles/contents/0000007/7861/6.3mokuji.pdf",
      ),
    ).toBe(false);
  });
});

describe("parseIndexPage", () => {
  it("記事ページの URL とタイトルを抽出する", () => {
    const html = `
      <article class="cate_post02">
        <ul>
          <li><a href="/0000007861.html">令和6年第2回（3月）定例会会議録</a></li>
          <li><a href="https://www.town.shiga-hino.lg.jp/0000007862.html">令和6年第3回（5月16日）臨時会会議録</a></li>
        </ul>
      </article>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe("https://www.town.shiga-hino.lg.jp/0000007861.html");
    expect(result[0]!.title).toBe("令和6年第2回（3月）定例会会議録");
    expect(result[1]!.url).toBe("https://www.town.shiga-hino.lg.jp/0000007862.html");
  });

  it("会議録以外の 7-10 桁記事リンクは除外する", () => {
    const html = `
      <a href="/0000007861.html">令和6年第2回（3月）定例会会議録</a>
      <a href="/0000006723.html">地図・フロア案内</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年第2回（3月）定例会会議録");
  });
});

describe("parseDetailPage", () => {
  it("記事ページから会議録 PDF を抽出する", () => {
    const html = `
      <div class="mol_attachfileblock block_index_2">
        <p class="mol_attachfileblock_title">令和6年第2回（3月）定例会</p>
        <ul>
          <li><a href="./cmsfiles/contents/0000007/7861/6.3mokuji.pdf">目次.pdf(サイズ：169.70KB)</a></li>
          <li><a href="./cmsfiles/contents/0000007/7861/20240301kaigiroku.pdf">第1日(3月1日).pdf(サイズ：715.13KB)</a></li>
          <li><a href="./cmsfiles/contents/0000007/7861/20240307kaigiroku.pdf">第2日(3月7日).pdf(サイズ：1.26MB)</a></li>
        </ul>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "令和6年第2回（3月）定例会会議録",
      "https://www.town.shiga-hino.lg.jp/0000007861.html",
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionTitle).toBe("令和6年第2回（3月）定例会会議録");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.shiga-hino.lg.jp/cmsfiles/contents/0000007/7861/20240301kaigiroku.pdf",
    );
    expect(result[0]!.linkText).toBe("第1日(3月1日)");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2024-03-01");
    expect(result[1]!.heldOn).toBe("2024-03-07");
  });

  it("臨時会を extraordinary として抽出する", () => {
    const html = `
      <div class="mol_attachfileblock">
        <ul>
          <li><a href="./cmsfiles/contents/0000007/7862/20240516kaigiroku.pdf">第1日(5月16日).pdf</a></li>
        </ul>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "令和6年第3回（5月16日）臨時会会議録",
      "https://www.town.shiga-hino.lg.jp/0000007862.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2024-05-16");
  });
});

describe("extractYearFromHeldOn", () => {
  it("heldOn から年を抽出する", () => {
    expect(extractYearFromHeldOn("2024-03-08")).toBe(2024);
  });

  it("null の場合は null を返す", () => {
    expect(extractYearFromHeldOn(null)).toBeNull();
  });
});
