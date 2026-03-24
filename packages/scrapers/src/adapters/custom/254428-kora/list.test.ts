import { describe, expect, it } from "vitest";
import {
  isMeetingMinutes,
  parseIndexPage,
  parseYearPage,
  extractYearFromHeldOn,
} from "./list";
import {
  buildHeldOn,
  detectMeetingType,
  extractMonthFromTitle,
  extractYearFromTitle,
} from "./shared";

describe("extractYearFromTitle", () => {
  it("令和6年を2024に変換する", () => {
    expect(extractYearFromTitle("令和6年3月甲良町議会定例会")).toBe(2024);
  });

  it("令和元年を2019に変換する", () => {
    expect(extractYearFromTitle("令和元年甲良町議会臨時会")).toBe(2019);
  });

  it("令和3年を2021に変換する", () => {
    expect(extractYearFromTitle("令和3年12月甲良町議会定例会")).toBe(2021);
  });

  it("平成31年を2019に変換する", () => {
    expect(extractYearFromTitle("平成31年・令和元年")).toBe(2019);
  });

  it("平成30年を2018に変換する", () => {
    expect(extractYearFromTitle("平成30年3月甲良町議会定例会")).toBe(2018);
  });

  it("年号が含まれない場合は null を返す", () => {
    expect(extractYearFromTitle("甲良町議会定例会")).toBeNull();
  });
});

describe("extractMonthFromTitle", () => {
  it("3月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年3月甲良町議会定例会")).toBe(3);
  });

  it("12月を抽出する", () => {
    expect(extractMonthFromTitle("令和6年12月甲良町議会定例会")).toBe(12);
  });

  it("臨時会で月なしの場合は null を返す", () => {
    expect(extractMonthFromTitle("令和6年第1回甲良町臨時会")).toBeNull();
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
    expect(detectMeetingType("令和6年3月甲良町議会定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和6年第1回甲良町臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務委員会")).toBe("committee");
  });
});

describe("isMeetingMinutes", () => {
  it("会議録は true", () => {
    expect(isMeetingMinutes("3月6日会議録")).toBe(true);
  });

  it("日程は false", () => {
    expect(isMeetingMinutes("日程")).toBe(false);
  });

  it("一般質問は false", () => {
    expect(isMeetingMinutes("一般質問")).toBe(false);
  });

  it("議決結果は false", () => {
    expect(isMeetingMinutes("議案等（議決結果）")).toBe(false);
  });

  it("議案等は false", () => {
    expect(isMeetingMinutes("議案等（議決結果） (PDFファイル: 73.9KB)")).toBe(false);
  });

  it("ファイルサイズ情報を含む会議録は true", () => {
    expect(isMeetingMinutes("2月5日会議録 (PDFファイル: 618.4KB)")).toBe(true);
  });
});

describe("parseIndexPage", () => {
  it("年度別ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html">令和6年</a></li>
        <li><a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2299.html">令和5年</a></li>
        <li><a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1611820493656.html">令和3年</a></li>
      </ul>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html");
    expect(result[1]).toBe("https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2299.html");
    expect(result[2]).toBe("https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1611820493656.html");
  });

  it("index.html は除外する", () => {
    const html = `
      <a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/index.html">一覧</a>
      <a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html">令和6年</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html");
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html">令和6年</a>
      <a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html">令和6年（再掲）</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
  });

  it("関係ないリンクは無視する", () => {
    const html = `
      <a href="/top.html">トップ</a>
      <a href="https://example.com">外部リンク</a>
      <a href="/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html">令和6年</a>
    `;

    const result = parseIndexPage(html);

    expect(result).toHaveLength(1);
  });
});

describe("parseYearPage", () => {
  const yearPageUrl = "https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html";

  it("会議録 PDF リンクを抽出する", () => {
    const html = `
      <h2>令和6年3月甲良町議会定例会</h2>
      <ul>
        <li><a href="//www.kouratown.jp/material/files/group/17/nittei3gatugikaiR6.pdf">日程 (PDFファイル: 53.2KB)</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/2024030607.pdf">一般質問 (PDFファイル: 436.0KB)</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/6322.pdf">議案等（議決結果） (PDFファイル: 96.6KB)</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240306.pdf">3月6日会議録 (PDFファイル: 1.7MB)</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240307.pdf">3月7日会議録 (PDFファイル: 960.7KB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.sessionTitle).toBe("令和6年3月甲良町議会定例会");
    expect(result[0]!.pdfUrl).toBe("https://www.kouratown.jp/material/files/group/17/20240306.pdf");
    expect(result[0]!.linkText).toBe("3月6日会議録");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2024-03-01");
    expect(result[0]!.yearPageUrl).toBe(yearPageUrl);

    expect(result[1]!.pdfUrl).toBe("https://www.kouratown.jp/material/files/group/17/20240307.pdf");
    expect(result[1]!.linkText).toBe("3月7日会議録");
  });

  it("臨時会を correctly に抽出する", () => {
    const html = `
      <h2>令和6年第1回甲良町臨時会</h2>
      <ul>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240205kaiki.pdf">日程 (PDFファイル: 37.9KB)</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/kaigiroku0205.pdf">2月5日会議録 (PDFファイル: 618.4KB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.linkText).toBe("2月5日会議録");
    expect(result[0]!.heldOn).toBeNull();
  });

  it("複数セクションから会議録を抽出する", () => {
    const html = `
      <h2>令和6年第1回甲良町臨時会</h2>
      <ul>
        <li><a href="//www.kouratown.jp/material/files/group/17/kaigiroku0205.pdf">2月5日会議録 (PDFファイル: 618.4KB)</a></li>
      </ul>
      <h2>令和6年3月甲良町議会定例会</h2>
      <ul>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240306.pdf">3月6日会議録 (PDFファイル: 1.7MB)</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240307.pdf">3月7日会議録 (PDFファイル: 960.7KB)</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl);

    expect(result).toHaveLength(3);
    expect(result[0]!.sessionTitle).toBe("令和6年第1回甲良町臨時会");
    expect(result[1]!.sessionTitle).toBe("令和6年3月甲良町議会定例会");
    expect(result[2]!.sessionTitle).toBe("令和6年3月甲良町議会定例会");
  });

  it("material/files/group/17/ を含まない href は除外する", () => {
    const html = `
      <h2>令和6年3月甲良町議会定例会</h2>
      <ul>
        <li><a href="/other/path/file.pdf">その他資料</a></li>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240306.pdf">3月6日会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe("https://www.kouratown.jp/material/files/group/17/20240306.pdf");
  });

  it("h2 がない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="//www.kouratown.jp/material/files/group/17/20240306.pdf">3月6日会議録</a></li>
      </ul>
    `;

    const result = parseYearPage(html, yearPageUrl);

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
