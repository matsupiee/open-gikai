import { describe, expect, it } from "vitest";
import { parseArticleLinks, parseCategoryLinks, parsePdfLinks } from "./list";
import { parseJapaneseDate, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和7年第4回定例会会議録")).toBe(2025);
  });

  it("令和元年を変換する", () => {
    expect(parseWarekiYear("令和元年第4回定例会一般質問")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成31年第1回定例会一般質問")).toBe(2019);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("会議録")).toBeNull();
  });
});

describe("parseJapaneseDate", () => {
  it("和暦日付を西暦に変換する", () => {
    expect(parseJapaneseDate("議案上程（令和7年12月10日）")).toBe("2025-12-10");
    expect(parseJapaneseDate("一般質問（令和元年12月11日）")).toBe("2019-12-11");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseJapaneseDate("松岡泉（まつおかいずみ）議員")).toBeNull();
  });
});

describe("parseCategoryLinks", () => {
  it("トップページからカテゴリリンクを抽出する", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/list433-45.html">会議録</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/list433-44.html">一般質問</a></span></li>
      </ul>
    `;

    expect(parseCategoryLinks(html)).toEqual([
      {
        title: "会議録",
        url: "https://www.town.ashiya.lg.jp/site/gikai/list433-45.html",
      },
      {
        title: "一般質問",
        url: "https://www.town.ashiya.lg.jp/site/gikai/list433-44.html",
      },
    ]);
  });
});

describe("parseArticleLinks", () => {
  it("一覧ページから記事リンクを抽出する", () => {
    const html = `
      <ul>
        <li><span class="article_title"><a href="/site/gikai/39295.html">令和8年第1回臨時会会議録</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/39251.html">令和7年第4回定例会会議録</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/39252.html">令和7年第4回定例会一般質問</a></span></li>
        <li><span class="article_title"><a href="/site/gikai/100.html">議会だより</a></span></li>
      </ul>
    `;

    expect(parseArticleLinks(html)).toEqual([
      {
        title: "令和8年第1回臨時会会議録",
        pageUrl: "https://www.town.ashiya.lg.jp/site/gikai/39295.html",
        meetingType: "extraordinary",
      },
      {
        title: "令和7年第4回定例会会議録",
        pageUrl: "https://www.town.ashiya.lg.jp/site/gikai/39251.html",
        meetingType: "plenary",
      },
      {
        title: "令和7年第4回定例会一般質問",
        pageUrl: "https://www.town.ashiya.lg.jp/site/gikai/39252.html",
        meetingType: "plenary",
      },
    ]);
  });
});

describe("parsePdfLinks", () => {
  it("会議録記事から複数の PDF 添付を抽出する", () => {
    const html = `
      <div class="detail_free">
        <p><a href="/uploaded/attachment/20743.pdf">議案上程（令和7年12月10日） [PDFファイル／411KB]</a></p>
        <p><a href="/uploaded/attachment/20741.pdf">一般質問（令和7年12月11日） [PDFファイル／862KB]</a></p>
        <p><a href="/uploaded/attachment/20745.pdf">表決（令和7年12月19日） [PDFファイル／365KB]</a></p>
      </div>
    `;

    const article = {
      title: "令和7年第4回定例会会議録",
      pageUrl: "https://www.town.ashiya.lg.jp/site/gikai/39251.html",
      meetingType: "plenary",
    };

    expect(parsePdfLinks(html, article)).toEqual([
      {
        title: "令和7年第4回定例会会議録 議案上程（令和7年12月10日）",
        pdfUrl: "https://www.town.ashiya.lg.jp/uploaded/attachment/20743.pdf",
        heldOn: "2025-12-10",
        meetingType: "plenary",
      },
      {
        title: "令和7年第4回定例会会議録 一般質問（令和7年12月11日）",
        pdfUrl: "https://www.town.ashiya.lg.jp/uploaded/attachment/20741.pdf",
        heldOn: "2025-12-11",
        meetingType: "plenary",
      },
      {
        title: "令和7年第4回定例会会議録 表決（令和7年12月19日）",
        pdfUrl: "https://www.town.ashiya.lg.jp/uploaded/attachment/20745.pdf",
        heldOn: "2025-12-19",
        meetingType: "plenary",
      },
    ]);
  });

  it("一般質問記事から議員ごとの PDF 添付を抽出する", () => {
    const html = `
      <div class="detail_free">
        <p><a href="/uploaded/attachment/20731.pdf">松岡泉（まつおかいずみ）議員 [PDFファイル／391KB]</a></p>
        <p><a href="/uploaded/attachment/20732.pdf">川上誠一（かわかみせいいち）議員 [PDFファイル／393KB]</a></p>
      </div>
    `;

    const article = {
      title: "令和7年第4回定例会一般質問",
      pageUrl: "https://www.town.ashiya.lg.jp/site/gikai/39252.html",
      meetingType: "plenary",
    };

    expect(parsePdfLinks(html, article)).toEqual([
      {
        title: "令和7年第4回定例会一般質問 松岡泉（まつおかいずみ）議員",
        pdfUrl: "https://www.town.ashiya.lg.jp/uploaded/attachment/20731.pdf",
        heldOn: null,
        meetingType: "plenary",
      },
      {
        title: "令和7年第4回定例会一般質問 川上誠一（かわかみせいいち）議員",
        pdfUrl: "https://www.town.ashiya.lg.jp/uploaded/attachment/20732.pdf",
        heldOn: null,
        meetingType: "plenary",
      },
    ]);
  });
});
