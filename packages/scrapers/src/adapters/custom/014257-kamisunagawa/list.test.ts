import { describe, expect, it } from "vitest";
import { parseSessionLinks, extractPdfRecords } from "./list";
import { parseNendoCode, yearToNendoCodes, detectMeetingType } from "./shared";

describe("parseNendoCode", () => {
  it("令和年度コードを変換する", () => {
    expect(parseNendoCode("r6")).toBe(2024);
    expect(parseNendoCode("r1")).toBe(2019);
    expect(parseNendoCode("r7")).toBe(2025);
  });

  it("平成年度コードを変換する", () => {
    expect(parseNendoCode("h30")).toBe(2018);
    expect(parseNendoCode("h19")).toBe(2007);
    expect(parseNendoCode("h31")).toBe(2019);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseNendoCode("unknown")).toBeNull();
    expect(parseNendoCode("")).toBeNull();
  });
});

describe("yearToNendoCodes", () => {
  it("令和年のみを持つ年は令和コードのみを返す", () => {
    expect(yearToNendoCodes(2024)).toEqual(["r6"]);
    expect(yearToNendoCodes(2025)).toEqual(["r7"]);
  });

  it("平成年のみを持つ年は平成コードのみを返す", () => {
    expect(yearToNendoCodes(2018)).toEqual(["h30"]);
    expect(yearToNendoCodes(2007)).toEqual(["h19"]);
  });

  it("令和元年/平成31年の重複する2019年は両方のコードを返す", () => {
    const codes = yearToNendoCodes(2019);
    expect(codes).toContain("r1");
    expect(codes).toContain("h31");
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
    expect(detectMeetingType("2024年第3回定例会")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会は committee を返す", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("parseSessionLinks", () => {
  it("年度別一覧ページから絶対 URL 形式のリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html">議会の結果・会議録（令和6年第4回定例会 12月11日〜12月13日）</a></li>
        <li><a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2163.html">議会の結果・会議録（令和6年第3回定例会 9月11日〜9月12日）</a></li>
        <li><a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2072.html">議会の結果・会議録（令和6年第2回定例会 6月19日〜6月21日）</a></li>
        <li><a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/1973.html">議会の結果・会議録（令和6年第1回定例会 3月7日〜3月18日）</a></li>
      </ul>
    `;

    const result = parseSessionLinks(html, "r6", "teirei");

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html",
      pageId: "2222",
    });
    expect(result[1]).toMatchObject({
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2163.html",
      pageId: "2163",
    });
  });

  it("相対 URL 形式のリンクも処理する", () => {
    const html = `
      <ul>
        <li><a href="2222.html">第1回定例会（3月7日〜3月18日）</a></li>
        <li><a href="2350.html">第2回定例会（6月10日〜6月21日）</a></li>
      </ul>
    `;

    const result = parseSessionLinks(html, "r6", "teirei");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html",
      pageId: "2222",
    });
  });

  it("臨時会のリンクを正しく生成する", () => {
    const html = `
      <ul>
        <li><a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/rinji/r6/1973.html">議会の結果・会議録（令和6年第1回臨時会 5月10日）</a></li>
      </ul>
    `;

    const result = parseSessionLinks(html, "r6", "rinji");

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(
      "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/rinji/r6/1973.html"
    );
    expect(result[0]!.pageId).toBe("1973");
  });

  it("重複するページ ID を除外する", () => {
    const html = `
      <a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html">第1回定例会</a>
      <a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html">第1回定例会（再掲）</a>
    `;

    const result = parseSessionLinks(html, "r6", "teirei");
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>リンクなし</p>";
    expect(parseSessionLinks(html, "r6", "teirei")).toEqual([]);
  });
});

describe("extractPdfRecords", () => {
  it("PDF リンクからセッション情報を抽出する", () => {
    const html = `
      <div>
        <a href="//town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_r6_t1.pdf">
          会議録（令和6年第1回定例会 3月7日〜3月18日）(PDFファイル: 2.3MB)
        </a>
      </div>
    `;

    const link = {
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html",
      pageId: "2222",
      title: "第1回定例会",
      period: "3月7日〜3月18日",
    };

    const result = extractPdfRecords(html, link, "r6", "teirei");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_r6_t1.pdf"
    );
    expect(result[0]!.heldOn).toBe("2024-03-07");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.nendoCode).toBe("r6");
    expect(result[0]!.sessionType).toBe("teirei");
    expect(result[0]!.pageId).toBe("2222");
  });

  it("https: 形式の PDF リンクも処理する", () => {
    const html = `
      <a href="https://town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_r7_r5.pdf">
        会議録（令和7年第5回臨時会 8月1日）(PDFファイル: 1.5MB)
      </a>
    `;

    const link = {
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/rinji/r7/3000.html",
      pageId: "3000",
      title: "第5回臨時会",
      period: "8月1日",
    };

    const result = extractPdfRecords(html, link, "r7", "rinji");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_r7_r5.pdf"
    );
    expect(result[0]!.heldOn).toBe("2025-08-01");
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("平成年度コードでも日付を正しく計算する", () => {
    const html = `
      <a href="//town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_h30_t1.pdf">
        会議録（平成30年第1回定例会 3月5日〜3月16日）(PDFファイル: 2.0MB)
      </a>
    `;

    const link = {
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/h30/1500.html",
      pageId: "1500",
      title: "第1回定例会",
      period: "3月5日〜3月16日",
    };

    const result = extractPdfRecords(html, link, "h30", "teirei");

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2018-03-05");
  });

  it("kaigiroku を含まない PDF リンクは除外する", () => {
    const html = `
      <a href="//town.kamisunagawa.hokkaido.jp/material/files/group/8/schedule.pdf">
        会期日程(PDFファイル: 0.5MB)
      </a>
      <a href="//town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_r6_t1.pdf">
        会議録（令和6年第1回定例会 3月7日）(PDFファイル: 2.3MB)
      </a>
    `;

    const link = {
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html",
      pageId: "2222",
      title: "第1回定例会",
      period: "",
    };

    const result = extractPdfRecords(html, link, "r6", "teirei");
    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toContain("kaigiroku_r6_t1.pdf");
  });

  it("日付を含まないリンクテキストは除外する", () => {
    const html = `
      <a href="//town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_r6_t1.pdf">
        会議録（令和6年第1回定例会）(PDFファイル: 2.3MB)
      </a>
    `;

    const link = {
      url: "https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html",
      pageId: "2222",
      title: "第1回定例会",
      period: "",
    };

    const result = extractPdfRecords(html, link, "r6", "teirei");
    expect(result).toHaveLength(0);
  });
});
