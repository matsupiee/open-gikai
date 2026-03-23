import { describe, expect, it } from "vitest";
import { parseLinkText, parseListPage } from "./list";
import {
  toHalfWidth,
  convertWarekiDateToISO,
  convertWarekiToWesternYear,
  detectMeetingType,
} from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和２年３月９日")).toBe("令和2年3月9日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });

  it("全角半角が混在する文字列を処理する", () => {
    expect(toHalfWidth("第１回定例会2日目")).toBe("第1回定例会2日目");
  });
});

describe("convertWarekiDateToISO", () => {
  it("令和の全角日付を変換する", () => {
    expect(convertWarekiDateToISO("令和２年３月９日")).toBe("2020-03-09");
  });

  it("令和の半角日付を変換する", () => {
    expect(convertWarekiDateToISO("令和6年12月10日")).toBe("2024-12-10");
  });

  it("令和元年に対応する", () => {
    expect(convertWarekiDateToISO("令和元年６月１０日")).toBe("2019-06-10");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiDateToISO("2024年3月1日")).toBeNull();
  });
});

describe("convertWarekiToWesternYear", () => {
  it("令和の年を変換する", () => {
    expect(convertWarekiToWesternYear("令和１年")).toBe(2019);
    expect(convertWarekiToWesternYear("令和6年")).toBe(2024);
  });

  it("全角数字に対応する", () => {
    expect(convertWarekiToWesternYear("令和２年")).toBe(2020);
  });

  it("令和元年に対応する", () => {
    expect(convertWarekiToWesternYear("令和元年")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiToWesternYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("臨時会")).toBe("extraordinary");
  });

  it("デフォルトはplenaryを返す", () => {
    expect(detectMeetingType("本会議")).toBe("plenary");
  });
});

describe("parseLinkText", () => {
  it("旧形式のリンクテキストをパースする（全角数字・第N日）", () => {
    const result = parseLinkText(
      "第１回定例会本会議 第１日(令和２年３月９日開催)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会本会議 第1日");
    expect(result!.heldOn).toBe("2020-03-09");
    expect(result!.meetingType).toBe("plenary");
  });

  it("新形式のリンクテキストをパースする（半角数字・N日目）", () => {
    const result = parseLinkText(
      "第２回臨時会本会議1日目（令和４年３月２５日開催）"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第2回臨時会本会議 第1日");
    expect(result!.heldOn).toBe("2022-03-25");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("令和6年の定例会をパースする", () => {
    const result = parseLinkText(
      "第４回定例会本会議 第１日（令和６年１２月１０日開催）"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第4回定例会本会議 第1日");
    expect(result!.heldOn).toBe("2024-12-10");
    expect(result!.meetingType).toBe("plenary");
  });

  it("令和元年のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第１回定例会本会議 第１日(令和元年６月１０日開催)"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会本会議 第1日");
    expect(result!.heldOn).toBe("2019-06-10");
    expect(result!.meetingType).toBe("plenary");
  });

  it("会議録と関係ないテキストはnullを返す", () => {
    expect(parseLinkText("一般質問一覧")).toBeNull();
    expect(parseLinkText("議事日程")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("PDFリンクから会議情報を抽出する", () => {
    const html = `
      <div class="entry-content">
        <p><a href="/manage/wp-content/themes/akaigawa/asset/file/kurashi/gyosei/第１回定例会本会議 第１日(令和２年３月９日開催).pdf">第１回定例会本会議 第１日(令和２年３月９日開催)</a></p>
        <p><a href="/manage/wp-content/uploads/2022/11/609515af5b3b51b9eefd0ec3c3699cd6.pdf">第２回臨時会本会議1日目（令和４年３月２５日開催）</a></p>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第1回定例会本会議 第1日",
      heldOn: "2020-03-09",
      pdfUrl:
        "https://www.akaigawa.com/manage/wp-content/themes/akaigawa/asset/file/kurashi/gyosei/第１回定例会本会議 第１日(令和２年３月９日開催).pdf",
      meetingType: "plenary",
    });
    expect(result[1]).toEqual({
      title: "第2回臨時会本会議 第1日",
      heldOn: "2022-03-25",
      pdfUrl:
        "https://www.akaigawa.com/manage/wp-content/uploads/2022/11/609515af5b3b51b9eefd0ec3c3699cd6.pdf",
      meetingType: "extraordinary",
    });
  });

  it("一般質問資料を除外する", () => {
    const html = `
      <p><a href="/file/一般質問一覧.pdf">一般質問一覧</a></p>
      <p><a href="/file/質問事項.pdf">質問事項一覧表</a></p>
      <p><a href="/file/資料.pdf">参考資料</a></p>
      <p><a href="/file/meeting.pdf">第１回定例会本会議 第１日(令和２年３月９日開催)</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第1回定例会本会議 第1日");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("会議情報をパースできないPDFリンクは除外する", () => {
    const html = `
      <p><a href="/file/unknown.pdf">不明なファイル</a></p>
    `;
    expect(parseListPage(html)).toEqual([]);
  });

  it("絶対URLのリンクをそのまま使用する", () => {
    const html = `
      <p><a href="https://www.akaigawa.com/file/meeting.pdf">第１回定例会本会議 第１日(令和２年３月９日開催)</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.akaigawa.com/file/meeting.pdf"
    );
  });
});
