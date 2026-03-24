import { describe, expect, it } from "vitest";
import {
  extractPdfLinks,
  guessYearFromFileName,
  parseMeetingInfo,
  parseMeetingList,
} from "./list";

describe("extractPdfLinks", () => {
  it("PDF リンクを抽出し、ファイルサイズ表記を除去する", () => {
    const html = `
      <ul>
        <li><a href="/hotnews/files/00000300/00000317/07_1tei_kaigiroku.pdf">令和7年第1回定例会(PDF文書：1.2MB)</a></li>
        <li><a href="/hotnews/files/00000300/00000317/07_1rinji_kaigiroku.pdf">令和7年第1回臨時会(PDF文書：500KB)</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/07_1tei_kaigiroku.pdf"
    );
    expect(result[0]!.linkText).toBe("令和7年第1回定例会");
    expect(result[1]!.linkText).toBe("令和7年第1回臨時会");
  });

  it("ファイルサイズ表記なしのリンクも正しく処理する", () => {
    const html = `
      <ul>
        <li><a href="/hotnews/files/00000300/00000317/07_toku_yosan.pdf">令和7年予算審査特別委員会</a></li>
      </ul>
    `;

    const result = extractPdfLinks(html);
    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("令和7年予算審査特別委員会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(extractPdfLinks(html)).toEqual([]);
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `<a href="https://example.com/file.pdf">テスト</a>`;
    const result = extractPdfLinks(html);
    expect(result[0]!.pdfUrl).toBe("https://example.com/file.pdf");
  });
});

describe("guessYearFromFileName", () => {
  it("令和7年 (07_...) → 2025", () => {
    expect(guessYearFromFileName("07_1tei_kaigiroku.pdf")).toBe(2025);
  });

  it("令和6年 (06_...) → 2024", () => {
    expect(guessYearFromFileName("06_1tei_kaigiroku.pdf")).toBe(2024);
  });

  it("令和元年 (01_...) → 2019", () => {
    expect(guessYearFromFileName("01_1tei_kaigiroku.pdf")).toBe(2019);
  });

  it("令和2年 (02_...) → 2020", () => {
    expect(guessYearFromFileName("02_1tei_kaigiroku.pdf")).toBe(2020);
  });

  it("平成31年 (31_...) → 2019", () => {
    expect(guessYearFromFileName("31_1tei.pdf")).toBe(2019);
  });

  it("平成30年 (30_...) → 2018", () => {
    expect(guessYearFromFileName("30_1tei.pdf")).toBe(2018);
  });

  it("平成29年 (29toku_...) → 2017", () => {
    expect(guessYearFromFileName("29toku_yosan.pdf")).toBe(2017);
  });

  it("平成28年 (28.1tei...) → 2016", () => {
    expect(guessYearFromFileName("28.1tei.pdf")).toBe(2016);
  });

  it("平成27年 (27teirei_...) → 2015", () => {
    expect(guessYearFromFileName("27teirei_01.pdf")).toBe(2015);
  });

  it("平成26年 (26teirei_...) → 2014", () => {
    expect(guessYearFromFileName("26teirei_01.pdf")).toBe(2014);
  });

  it("平成25年 (25_...) → 2013", () => {
    expect(guessYearFromFileName("25_1tei.pdf")).toBe(2013);
  });

  it("数字がない場合は null", () => {
    expect(guessYearFromFileName("rinji_01.pdf")).toBeNull();
  });
});

describe("parseMeetingInfo", () => {
  it("定例会（令和年号付き）を解析する", () => {
    const result = parseMeetingInfo(
      "令和7年第1回定例会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/07_1tei_kaigiroku.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年第1回定例会");
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("plenary");
    expect(result!.heldOn).toBeNull();
  });

  it("臨時会を解析する", () => {
    const result = parseMeetingInfo(
      "令和6年第1回臨時会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/06_1rinji_kaigiroku.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("予算審査特別委員会を解析する", () => {
    const result = parseMeetingInfo(
      "令和7年予算審査特別委員会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/07_toku_yosan.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.meetingType).toBe("committee");
  });

  it("決算審査特別委員会を解析する", () => {
    const result = parseMeetingInfo(
      "令和6年決算審査特別委員会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/06_toku_kessan.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.meetingType).toBe("committee");
  });

  it("令和元年を解析する", () => {
    const result = parseMeetingInfo(
      "令和元年第1回定例会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/01_1tei_kaigiroku.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
  });

  it("平成年号を解析する", () => {
    const result = parseMeetingInfo(
      "平成30年第1回定例会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/30_1tei.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2018);
  });

  it("リンクテキストに年号がない場合はファイル名から年度を推定する", () => {
    const result = parseMeetingInfo(
      "第1回定例会",
      "https://www.town.matsumae.hokkaido.jp/hotnews/files/00000300/00000317/06_1tei_kaigiroku.pdf"
    );

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
  });
});

describe("parseMeetingList", () => {
  it("指定年の会議のみを返す", () => {
    const html = `
      <ul>
        <li><a href="/hotnews/files/00000300/00000317/07_1tei_kaigiroku.pdf">令和7年第1回定例会</a></li>
        <li><a href="/hotnews/files/00000300/00000317/06_1tei_kaigiroku.pdf">令和6年第1回定例会</a></li>
        <li><a href="/hotnews/files/00000300/00000317/06_2tei_kaigiroku.pdf">令和6年第2回定例会</a></li>
        <li><a href="/hotnews/files/00000300/00000317/05_1tei_kaigiroku.pdf">令和5年第1回定例会</a></li>
      </ul>
    `;

    const result = parseMeetingList(html, 2024);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2024);
    expect(result[1]!.year).toBe(2024);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    expect(parseMeetingList(html, 2024)).toEqual([]);
  });

  it("対象年が一致しない場合は空配列を返す", () => {
    const html = `
      <ul>
        <li><a href="/hotnews/files/00000300/00000317/07_1tei_kaigiroku.pdf">令和7年第1回定例会</a></li>
      </ul>
    `;

    expect(parseMeetingList(html, 2024)).toEqual([]);
  });

  it("種別を正しく分類する", () => {
    const html = `
      <ul>
        <li><a href="/hotnews/files/00000300/00000317/06_1tei_kaigiroku.pdf">令和6年第1回定例会</a></li>
        <li><a href="/hotnews/files/00000300/00000317/06_1rinji_kaigiroku.pdf">令和6年第1回臨時会</a></li>
        <li><a href="/hotnews/files/00000300/00000317/06_toku_yosan.pdf">令和6年予算審査特別委員会</a></li>
        <li><a href="/hotnews/files/00000300/00000317/06_toku_kessan.pdf">令和6年決算審査特別委員会</a></li>
      </ul>
    `;

    const result = parseMeetingList(html, 2024);

    expect(result).toHaveLength(4);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[2]!.meetingType).toBe("committee");
    expect(result[3]!.meetingType).toBe("committee");
  });
});
