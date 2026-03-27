import { describe, expect, it } from "vitest";
import { parseYearPage, parseYearPageLinks } from "./list";
import { detectMeetingType, parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和8年村議会会議録")).toBe(2026);
    expect(parseWarekiYear("令和元年村議会会議録")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年村議会会議録")).toBe(2018);
    expect(parseWarekiYear("平成元年村議会会議録")).toBe(1989);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("会議録")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会は plenary を返す", () => {
    expect(detectMeetingType("令和7年村議会6月定例会会議録")).toBe("plenary");
  });

  it("臨時会は extraordinary を返す", () => {
    expect(detectMeetingType("令和7年村議会第1回臨時会会議録")).toBe("extraordinary");
  });
});

describe("parseYearPageLinks", () => {
  it("一覧ページから年別ページを抽出する", () => {
    const html = `
      <ul class="level1col2 clearfix">
        <li class="page">
          <a href="https://www.vill.asahi.nagano.jp/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/4956.html">令和8年村議会会議録</a>
        </li>
        <li class="page">
          <a href="https://www.vill.asahi.nagano.jp/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/4516.html">令和7年村議会会議録</a>
        </li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "令和8年村議会会議録",
      year: 2026,
      yearPageUrl:
        "https://www.vill.asahi.nagano.jp/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/4956.html",
      pageId: "4956",
    });
    expect(result[1]!.year).toBe(2025);
  });

  it("平成と令和元年を含む一覧にも対応する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.asahi.nagano.jp/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/1287.html">令和元年村議会会議録</a></li>
        <li><a href="https://www.vill.asahi.nagano.jp/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/401.html">平成30年村議会会議録</a></li>
      </ul>
    `;

    const result = parseYearPageLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2019);
    expect(result[1]!.year).toBe(2018);
  });
});

describe("parseYearPage", () => {
  const yearPage = {
    title: "令和7年村議会会議録",
    year: 2025,
    yearPageUrl:
      "https://www.vill.asahi.nagano.jp/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/4516.html",
    pageId: "4516",
  } as const;

  it("年別ページから PDF レコードを抽出する", () => {
    const html = `
      <div class="free-layout-area">
        <p class="file-link-item">
          <a class="pdf" href="//www.vill.asahi.nagano.jp/material/files/group/2/gijiroku_7_rinji_1.pdf">
            令和7年村議会第1回臨時会会議録 (PDFファイル: 238.2KB)
          </a>
        </p>
        <p class="file-link-item">
          <a class="pdf" href="//www.vill.asahi.nagano.jp/material/files/group/2/kaigiroku_r7_6.pdf">
            令和7年村議会6月定例会会議録 (PDFファイル: 1.2MB)
          </a>
        </p>
      </div>
    `;

    const result = parseYearPage(html, yearPage);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和7年村議会第1回臨時会会議録");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.vill.asahi.nagano.jp/material/files/group/2/gijiroku_7_rinji_1.pdf",
    );
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.sessionKey).toBe("asahi_nagano_4516_0");
    expect(result[1]!.title).toBe("令和7年村議会6月定例会会議録");
    expect(result[1]!.meetingType).toBe("plenary");
  });

  it("PDF 以外のリンクは無視する", () => {
    const html = `
      <div>
        <a href="/test.html">お知らせ</a>
      </div>
    `;

    expect(parseYearPage(html, yearPage)).toEqual([]);
  });
});
