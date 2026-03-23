import { describe, expect, it } from "vitest";
import {
  convertHeadingToWesternYear,
  detectMeetingType,
  toHalfWidth,
} from "./shared";
import { normalizeLinkText, parseListPage } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和５年")).toBe("令和5年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("convertHeadingToWesternYear", () => {
  it("令和の半角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和5年")).toBe(2023);
    expect(convertHeadingToWesternYear("令和4年")).toBe(2022);
  });

  it("令和の全角数字を変換する", () => {
    expect(convertHeadingToWesternYear("令和５年")).toBe(2023);
  });

  it("令和元年を変換する", () => {
    expect(convertHeadingToWesternYear("令和元年")).toBe(2019);
  });

  it("令和1年を変換する", () => {
    expect(convertHeadingToWesternYear("令和1年")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(convertHeadingToWesternYear("平成30年")).toBe(2018);
  });

  it("平成元年を変換する", () => {
    expect(convertHeadingToWesternYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertHeadingToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会 2月")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("予算審査特別委員会")).toBe("committee");
  });
});

describe("normalizeLinkText", () => {
  it("ファイルサイズ表記を除去する", () => {
    expect(normalizeLinkText("第1回定例会（PDF：2.47メガバイト）")).toBe(
      "第1回定例会",
    );
  });

  it("全角数字を半角に変換する", () => {
    expect(normalizeLinkText("第１回臨時会 ２月（PDF：1.08メガバイト）")).toBe(
      "第1回臨時会 2月",
    );
  });

  it("imgタグを除去する", () => {
    expect(
      normalizeLinkText(
        '<img src="icon/pdf.gif" alt=""> 第1回定例会（PDF：1.08メガバイト） <img src="newwin.gif" alt="">',
      ),
    ).toBe("第1回定例会");
  });

  it("余分な空白を除去する", () => {
    expect(normalizeLinkText("  第1回定例会  ")).toBe("第1回定例会");
  });

  it("キロバイト表記を除去する", () => {
    expect(
      normalizeLinkText("第3回臨時会11月（PDF：534.7キロバイト）"),
    ).toBe("第3回臨時会11月");
  });

  it("&nbsp;を除去する", () => {
    expect(normalizeLinkText("&nbsp;第1回定例会&nbsp;")).toBe("第1回定例会");
  });
});

describe("parseListPage", () => {
  it("th scope=row 見出しとPDFリンクを抽出する", () => {
    const html = `
      <tr><th scope="row"><p>令</p><p>和</p><p>5</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_2_202303teirei_kaigiroku.pdf">
        <img src="icon/pdf.gif" alt="">&nbsp;第1回定例会（PDF：2.47メガバイト）&nbsp;<img src="newwin.gif" alt="">
      </a></p></td></tr>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "第1回定例会",
      pdfUrl:
        "https://www.town.hasami.lg.jp/kiji003879/3_879_2_202303teirei_kaigiroku.pdf",
      meetingType: "plenary",
      headingYear: 2023,
    });
  });

  it("複数年度・複数PDFリンクを正しく紐付ける", () => {
    const html = `
      <tr><th scope="row"><p>令</p><p>和</p><p>5</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_1_202302rinji_gikai_kaigiroku.pdf">
        第1回臨時会 2月（PDF：1.08メガバイト）
      </a></p></td>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_2_202303teirei_kaigiroku.pdf">
        第1回定例会（PDF：2.47メガバイト）
      </a></p></td></tr>
      <tr><th scope="row"><p>令</p><p>和</p><p>4</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_8_R403teireikai-1.pdf">
        第1回定例会（PDF：3.39メガバイト）
      </a></p></td></tr>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.headingYear).toBe(2023);
    expect(result[0]!.title).toBe("第1回臨時会 2月");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[1]!.headingYear).toBe(2023);
    expect(result[1]!.title).toBe("第1回定例会");
    expect(result[1]!.meetingType).toBe("plenary");
    expect(result[2]!.headingYear).toBe(2022);
    expect(result[2]!.title).toBe("第1回定例会");
  });

  it("平成30年の見出しを正しく変換する", () => {
    const html = `
      <tr><th scope="row"><p>平</p><p>成</p><p>30</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_35_H3003061.pdf">
        第1回定例会（1日目）（PDF：859.8キロバイト）
      </a></p></td></tr>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2018);
    expect(result[0]!.title).toBe("第1回定例会（1日目）");
  });

  it("令和1年の見出しを正しく変換する", () => {
    const html = `
      <tr><th scope="row"><p>令</p><p>和</p><p>1</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_31_201903teireikai_kaigiroku.pdf">
        第1回定例会（PDF：1.72メガバイト）
      </a></p></td></tr>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2019);
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("kiji003879を含まないリンクはスキップする", () => {
    const html = `
      <tr><th scope="row"><p>令</p><p>和</p><p>5</p><p>年</p></th>
      <td><p><a href="https://www.town.hasami.lg.jp/other/document.pdf">
        その他の文書（PDF：100キロバイト）
      </a></p></td></tr>
    `;

    expect(parseListPage(html)).toEqual([]);
  });

  it("臨時会11月のようなスペースなしのタイトルも正しくパースする", () => {
    const html = `
      <tr><th scope="row"><p>令</p><p>和</p><p>5</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_6_202311gikai_rinji_kaigiroku.pdf">
        第3回臨時会11月（PDF：534.7キロバイト）
      </a></p></td></tr>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第3回臨時会11月");
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("&nbsp;を含むリンクテキストを正しく正規化する", () => {
    const html = `
      <tr><th scope="row"><p>令</p><p>和</p><p>5</p><p>年</p></th>
      <td><p><a target="_blank" href="https://www.town.hasami.lg.jp/kiji003879/3_879_2_test.pdf">
        <img src="icon/pdf.gif" alt="">&nbsp;第1回定例会（PDF：2.47メガバイト）&nbsp;<img src="newwin.gif" alt="">
      </a></p></td></tr>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会");
  });
});
