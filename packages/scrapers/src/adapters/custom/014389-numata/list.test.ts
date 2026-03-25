import { describe, expect, it } from "vitest";
import { parseLinkText, parseListPage, parseYearPageUrls } from "./list";
import { toHalfWidth, convertWarekiDateToISO, detectMeetingType } from "./shared";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和６年３月１日")).toBe("令和6年3月1日");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });

  it("全角半角が混在する文字列を処理する", () => {
    expect(toHalfWidth("第１回定例会2日目")).toBe("第1回定例会2日目");
  });
});

describe("convertWarekiDateToISO", () => {
  it("令和の日付を変換する", () => {
    expect(convertWarekiDateToISO("令和6年6月18日")).toBe("2024-06-18");
  });

  it("令和元年に対応する", () => {
    expect(convertWarekiDateToISO("令和元年6月20日")).toBe("2019-06-20");
  });

  it("令和7年に対応する", () => {
    expect(convertWarekiDateToISO("令和7年3月6日")).toBe("2025-03-06");
  });

  it("平成の日付を変換する", () => {
    expect(convertWarekiDateToISO("平成30年3月1日")).toBe("2018-03-01");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(convertWarekiDateToISO("2024年3月1日")).toBeNull();
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
  it("日次あり定例会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第1回（1日目）（令和7年3月6日） (PDF 123KB)",
      "定例会",
      "1"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会（1日目）");
    expect(result!.heldOn).toBe("2025-03-06");
    expect(result!.meetingType).toBe("plenary");
  });

  it("日次なし定例会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第2回（令和6年6月18日） (PDF 456KB)",
      "定例会",
      "2"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第2回定例会");
    expect(result!.heldOn).toBe("2024-06-18");
    expect(result!.meetingType).toBe("plenary");
  });

  it("臨時会のリンクテキストをパースする", () => {
    const result = parseLinkText(
      "第1回（令和6年2月5日） (PDF 200KB)",
      "臨時会",
      "1"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回臨時会");
    expect(result!.heldOn).toBe("2024-02-05");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("平成の日付をパースする", () => {
    const result = parseLinkText(
      "第1回（平成30年3月1日） (PDF 300KB)",
      "定例会",
      "1"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("第1回定例会");
    expect(result!.heldOn).toBe("2018-03-01");
  });

  it("令和元年をパースする", () => {
    const result = parseLinkText(
      "第1回（令和元年6月20日） (PDF 300KB)",
      "定例会",
      "1"
    );

    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-06-20");
  });

  it("日付がない場合はnullを返す", () => {
    expect(parseLinkText("議事日程.pdf", "定例会", "1")).toBeNull();
    expect(parseLinkText("一般質問", "定例会", "1")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h4/h5/ul 構造から PDF リンクを抽出する", () => {
    const baseUrl =
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000mzi1.html";
    const html = `
      <h4>定例会</h4>
      <h5>第1回定例会</h5>
      <ul>
        <li><a href="/section/gikai/h0opp2000000mzi1-att/h0opp2000000mzrx.pdf">第1回（1日目）（令和6年3月6日） (PDF 500KB)<img src="/WSR/icon_pdf.gif"></a></li>
        <li><a href="/section/gikai/h0opp2000000mzi1-att/h0opp2000000mzsa.pdf">第1回（2日目）（令和6年3月7日） (PDF 600KB)<img src="/WSR/icon_pdf.gif"></a></li>
      </ul>
      <h5>第2回定例会</h5>
      <ul>
        <li><a href="/section/gikai/h0opp2000000mzi1-att/h0opp2000000n012.pdf">第2回（令和6年6月18日） (PDF 400KB)<img src="/WSR/icon_pdf.gif"></a></li>
      </ul>
      <h4>臨時会</h4>
      <h5>第1回臨時会</h5>
      <ul>
        <li><a href="/section/gikai/h0opp2000000mzi1-att/h0opp2000000nabc.pdf">第1回（令和6年2月5日） (PDF 200KB)<img src="/WSR/icon_pdf.gif"></a></li>
      </ul>
    `;

    const result = parseListPage(html, baseUrl);

    expect(result).toHaveLength(4);

    expect(result[0]!.title).toBe("第1回定例会（1日目）");
    expect(result[0]!.heldOn).toBe("2024-03-06");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000mzi1-att/h0opp2000000mzrx.pdf"
    );
    expect(result[0]!.meetingType).toBe("plenary");

    expect(result[1]!.title).toBe("第1回定例会（2日目）");
    expect(result[1]!.heldOn).toBe("2024-03-07");

    expect(result[2]!.title).toBe("第2回定例会");
    expect(result[2]!.heldOn).toBe("2024-06-18");

    expect(result[3]!.title).toBe("第1回臨時会");
    expect(result[3]!.heldOn).toBe("2024-02-05");
    expect(result[3]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const baseUrl =
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000mzi1.html";
    const html = `
      <h4>定例会</h4>
      <p>会議録はありません</p>
    `;
    expect(parseListPage(html, baseUrl)).toEqual([]);
  });

  it("日付が取得できないリンクは除外する", () => {
    const baseUrl =
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000mzi1.html";
    const html = `
      <h4>定例会</h4>
      <h5>第1回定例会</h5>
      <ul>
        <li><a href="/section/gikai/h0opp2000000mzi1-att/unknown.pdf">不明なファイル<img src="/WSR/icon_pdf.gif"></a></li>
        <li><a href="/section/gikai/h0opp2000000mzi1-att/valid.pdf">第1回（令和6年3月6日） (PDF 500KB)<img src="/WSR/icon_pdf.gif"></a></li>
      </ul>
    `;

    const result = parseListPage(html, baseUrl);
    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2024-03-06");
  });
});

describe("parseYearPageUrls", () => {
  it("トップページから年度別ページの URL を取得する", () => {
    const html = `
      <ul>
        <li><a href="/section/gikai/h0opp2000000rbtu.html">令和7年</a></li>
        <li><a href="/section/gikai/h0opp2000000mzi1.html">令和6年</a></li>
        <li><a href="/section/gikai/h0opp2000000k42n.html">令和5年</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000rbtu.html"
    );
    expect(result[1]).toBe(
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000mzi1.html"
    );
    expect(result[2]).toBe(
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000k42n.html"
    );
  });

  it("index.html は除外する", () => {
    const html = `
      <ul>
        <li><a href="/section/gikai/index.html">議会トップ</a></li>
        <li><a href="/section/gikai/h0opp2000000rbtu.html">令和7年</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      "https://www.town.numata.hokkaido.jp/section/gikai/h0opp2000000rbtu.html"
    );
  });

  it("重複 URL は除外する", () => {
    const html = `
      <ul>
        <li><a href="/section/gikai/h0opp2000000rbtu.html">令和7年</a></li>
        <li><a href="/section/gikai/h0opp2000000rbtu.html">令和7年（重複）</a></li>
      </ul>
    `;

    const result = parseYearPageUrls(html);
    expect(result).toHaveLength(1);
  });

  it("該当リンクがない場合は空配列を返す", () => {
    const html = "<div><p>リンクなし</p></div>";
    expect(parseYearPageUrls(html)).toEqual([]);
  });
});
