import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import {
  dirToYear,
  dirToMeetingType,
  parseFileName,
} from "./shared";

describe("dirToYear", () => {
  it("r07 を令和7年 2025 に変換する", () => {
    expect(dirToYear("r07teirei")).toBe(2025);
  });

  it("r06 を令和6年 2024 に変換する", () => {
    expect(dirToYear("r06rinji")).toBe(2024);
  });

  it("r02 を令和2年 2020 に変換する", () => {
    expect(dirToYear("r02teirei")).toBe(2020);
  });

  it("r01 を令和元年 2019 に変換する", () => {
    expect(dirToYear("r01teirei")).toBe(2019);
  });

  it("h31 を平成31年 2019 に変換する", () => {
    expect(dirToYear("h31teirei")).toBe(2019);
  });

  it("H30 を平成30年 2018 に変換する", () => {
    expect(dirToYear("H30teirei")).toBe(2018);
  });

  it("h16 を平成16年 2004 に変換する", () => {
    expect(dirToYear("h16rinji")).toBe(2004);
  });

  it("不正なパターンは null を返す", () => {
    expect(dirToYear("other")).toBeNull();
  });
});

describe("dirToMeetingType", () => {
  it("teirei は plenary", () => {
    expect(dirToMeetingType("r07teirei")).toBe("plenary");
  });

  it("rinji は extraordinary", () => {
    expect(dirToMeetingType("r06rinji")).toBe("extraordinary");
  });

  it("大文字 RINJI も extraordinary", () => {
    expect(dirToMeetingType("H30RINJI")).toBe("extraordinary");
  });
});

describe("parseFileName", () => {
  it("07_3_4.pdf を正しくパースする", () => {
    const result = parseFileName("07_3_4.pdf");
    expect(result).not.toBeNull();
    expect(result!.session).toBe(3);
    expect(result!.day).toBe(4);
  });

  it("06_4_1.pdf を正しくパースする", () => {
    const result = parseFileName("06_4_1.pdf");
    expect(result).not.toBeNull();
    expect(result!.session).toBe(4);
    expect(result!.day).toBe(1);
  });

  it("31_1_5.pdf を正しくパースする", () => {
    const result = parseFileName("31_1_5.pdf");
    expect(result).not.toBeNull();
    expect(result!.session).toBe(1);
    expect(result!.day).toBe(5);
  });

  it("不正なファイル名は null を返す", () => {
    expect(parseFileName("invalid.pdf")).toBeNull();
    expect(parseFileName("07_3.pdf")).toBeNull();
  });
});

describe("parseListPage", () => {
  const sourceListUrl = "https://www.town.ryuoh.shiga.jp/parliament/gijiroku/gijiroku.html";

  it("令和7年の定例会 PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>第3回定例会</li>
        <li><a href="r07teirei/07_3_4.pdf">第4日</a></li>
        <li><a href="r07teirei/07_3_3.pdf">第3日</a></li>
        <li><a href="r07teirei/07_3_2.pdf">第2日</a></li>
        <li><a href="r07teirei/07_3_1.pdf">第1日</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(4);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.ryuoh.shiga.jp/parliament/gijiroku/r07teirei/07_3_4.pdf",
    );
    expect(result[0]!.linkText).toBe("第4日");
    expect(result[0]!.sessionTitle).toBe("第3回定例会");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.session).toBe(3);
    expect(result[0]!.day).toBe(4);
    expect(result[0]!.sourceListUrl).toBe(sourceListUrl);
  });

  it("臨時会 PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>臨時会</li>
        <li><a href="r06rinji/06_2_1.pdf">第2回</a></li>
        <li><a href="r06rinji/06_1_1.pdf">第1回</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.session).toBe(2);
    expect(result[0]!.day).toBe(1);
  });

  it("平成時代の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li>第1回定例会</li>
        <li><a href="h31teirei/31_1_5.pdf">第5日</a></li>
        <li><a href="h31teirei/31_1_1.pdf">第1日</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.year).toBe(2019);
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.session).toBe(1);
    expect(result[0]!.day).toBe(5);
  });

  it("大文字ディレクトリ（H30）も正しく処理する", () => {
    const html = `
      <ul>
        <li>第4回定例会</li>
        <li><a href="H30teirei/30_4_4.pdf">第4日</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2018);
  });

  it("複数会議のリンクを抽出する", () => {
    const html = `
      <ul>
        <li>第4回定例会</li>
        <li><a href="r06teirei/06_4_2.pdf">第2日</a></li>
        <li><a href="r06teirei/06_4_1.pdf">第1日</a></li>
      </ul>
      <ul>
        <li>第3回定例会</li>
        <li><a href="r06teirei/06_3_4.pdf">第4日</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(3);
    expect(result[0]!.sessionTitle).toBe("第4回定例会");
    expect(result[2]!.sessionTitle).toBe("第3回定例会");
    expect(result[2]!.session).toBe(3);
  });

  it("ディレクトリパターンに合致しない href は除外する", () => {
    const html = `
      <ul>
        <li><a href="/other/file.pdf">その他資料</a></li>
        <li>第3回定例会</li>
        <li><a href="r07teirei/07_3_1.pdf">第1日</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("第1日");
  });

  it("PDF でない href は除外する", () => {
    const html = `
      <ul>
        <li>第3回定例会</li>
        <li><a href="r07teirei/07_3_1.html">第1日</a></li>
        <li><a href="r07teirei/07_3_1.pdf">第1日(PDF)</a></li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.linkText).toBe("第1日(PDF)");
  });

  it("空の HTML は空配列を返す", () => {
    const result = parseListPage("", sourceListUrl);
    expect(result).toHaveLength(0);
  });

  it("PDFリンクのない HTML は空配列を返す", () => {
    const html = `
      <ul>
        <li>第3回定例会</li>
        <li>第2回定例会</li>
      </ul>
    `;

    const result = parseListPage(html, sourceListUrl);
    expect(result).toHaveLength(0);
  });
});
