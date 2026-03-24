import { describe, expect, it } from "vitest";
import {
  convertWarekiToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { extractTitle, parseDateFromRowText, parseListPage } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年")).toBe("令和6年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertWarekiToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertWarekiToWesternYear("令和6年定例9月会議")).toBe(2024);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertWarekiToWesternYear("令和６年定例９月会議")).toBe(2024);
  });

  it("令和元年を変換する", () => {
    expect(convertWarekiToWesternYear("令和元年定例会")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertWarekiToWesternYear("平成30年定例会")).toBe(2018);
    expect(convertWarekiToWesternYear("平成16年定例会")).toBe(2004);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会議をplenaryと判定する", () => {
    expect(detectMeetingType("令和6年定例9月会議")).toBe("plenary");
    expect(detectMeetingType("令和6年定例12月会議（1日目）")).toBe("plenary");
  });

  it("臨時会議をextraordinaryと判定する", () => {
    expect(detectMeetingType("令和6年臨時会議")).toBe("extraordinary");
    expect(detectMeetingType("令和6年4月臨時会議")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("令和6年常任委員会")).toBe("committee");
  });

  it("月会議はplenaryと判定する", () => {
    expect(detectMeetingType("令和6年9月会議")).toBe("plenary");
  });
});

describe("extractTitle", () => {
  it("PDFファイルサイズ情報を除去する", () => {
    expect(extractTitle("令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)")).toBe(
      "令和6年定例9月会議（1日目）",
    );
  });

  it("先頭の YYYY/M/D 形式日付を除去する", () => {
    expect(extractTitle("2024/9/10 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)")).toBe(
      "令和6年定例9月会議（1日目）",
    );
  });

  it("先頭の YYYY年M月D日 形式日付を除去する", () => {
    expect(extractTitle("2024年9月10日 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)")).toBe(
      "令和6年定例9月会議（1日目）",
    );
  });

  it("日付もPDFサイズ情報もない場合はそのまま返す", () => {
    expect(extractTitle("令和6年定例9月会議（1日目）")).toBe(
      "令和6年定例9月会議（1日目）",
    );
  });
});

describe("parseDateFromRowText", () => {
  it("YYYY/M/D 形式の日付をパースする", () => {
    expect(parseDateFromRowText("2024/9/10 令和6年定例9月会議")).toBe("2024-09-10");
  });

  it("YYYY年M月D日 形式の日付をパースする", () => {
    expect(parseDateFromRowText("2024年9月10日 令和6年定例9月会議（1日目）")).toBe("2024-09-10");
  });

  it("1桁の月・日もゼロパディングする（スラッシュ形式）", () => {
    expect(parseDateFromRowText("2024/6/5 令和6年6月会議")).toBe("2024-06-05");
  });

  it("1桁の月・日もゼロパディングする（漢字形式）", () => {
    expect(parseDateFromRowText("2024年6月5日 令和6年6月会議")).toBe("2024-06-05");
  });

  it("2桁の月・日はそのまま返す", () => {
    expect(parseDateFromRowText("2024/12/18 令和6年12月会議")).toBe("2024-12-18");
  });

  it("日付パターンがない場合はnullを返す", () => {
    expect(parseDateFromRowText("令和6年定例9月会議（1日目）")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("実際のサイト形式（YYYY年M月D日 タイトル）の PDF リンクを抽出する", () => {
    const html = `
      <a href="//www.town.ojika.lg.jp/material/files/group/9/gijiroku9-1.pdf">
        2024年9月10日 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年定例9月会議（1日目）");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.ojika.lg.jp/material/files/group/9/gijiroku9-1.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.year).toBe(2024);
    expect(result[0]!.heldOn).toBe("2024-09-10");
  });

  it("タイトルのみ（日付なし）の PDF リンクを抽出する", () => {
    const html = `
      <a href="//www.town.ojika.lg.jp/material/files/group/9/gijiroku9-1.pdf">
        令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年定例9月会議（1日目）");
    expect(result[0]!.heldOn).toBeNull();
  });

  it("複数の PDF リンクを抽出する", () => {
    const html = `
      <a href="//www.town.ojika.lg.jp/material/files/group/9/gijiroku9-1.pdf">
        2024年9月10日 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)
      </a>
      <a href="//www.town.ojika.lg.jp/material/files/group/9/gijiroku9-2.pdf">
        2024年9月18日 令和6年定例9月会議（2日目）(PDFファイル: 829.7KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("令和6年定例9月会議（1日目）");
    expect(result[1]!.title).toBe("令和6年定例9月会議（2日目）");
  });

  it("ハッシュ値ファイル名の PDF リンクも抽出する", () => {
    const html = `
      <a href="//www.town.ojika.lg.jp/material/files/group/9/526b77f6e6ddaaa308460ca21594ef00.pdf">
        2024年7月25日 令和6年7月会議(PDFファイル: 230.0KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年7月会議");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.ojika.lg.jp/material/files/group/9/526b77f6e6ddaaa308460ca21594ef00.pdf",
    );
    expect(result[0]!.heldOn).toBe("2024-07-25");
  });

  it("臨時会議をextraordinaryと判定する", () => {
    const html = `
      <a href="//www.town.ojika.lg.jp/material/files/group/9/rinji.pdf">
        2024年4月12日 令和6年4月臨時会議(PDFファイル: 200.0KB)
      </a>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("和暦が含まれない場合はスキップする", () => {
    const html = `
      <a href="//www.town.ojika.lg.jp/material/files/group/9/doc.pdf">
        議会だより(PDFファイル: 100KB)
      </a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(0);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    expect(parseListPage("<p>会議録はありません</p>")).toEqual([]);
  });
});
