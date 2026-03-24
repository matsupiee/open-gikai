import { describe, expect, it } from "vitest";
import { parseListPage, parseMeetingText, resolvePdfUrl } from "./list";
import { parseWarekiYear } from "./shared";

describe("parseWarekiYear", () => {
  it("令和の年を変換する", () => {
    expect(parseWarekiYear("令和6年第1回")).toBe(2024);
    expect(parseWarekiYear("令和8年第1回")).toBe(2026);
  });

  it("令和元年に対応する", () => {
    expect(parseWarekiYear("令和元年第1回")).toBe(2019);
  });

  it("平成の年を変換する", () => {
    expect(parseWarekiYear("平成30年第1回")).toBe(2018);
    expect(parseWarekiYear("平成元年第1回")).toBe(1989);
  });

  it("マッチしない場合は null を返す", () => {
    expect(parseWarekiYear("2024年")).toBeNull();
  });
});

describe("resolvePdfUrl", () => {
  it("絶対 URL はそのまま返す", () => {
    expect(
      resolvePdfUrl(
        "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
      ),
    ).toBe(
      "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
    );
  });

  it("../../ 形式の相対パスを絶対 URL に変換する", () => {
    expect(
      resolvePdfUrl("../../common/img/content/content_20260127_120000.pdf"),
    ).toBe(
      "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
    );
  });

  it("/ から始まる相対パスを絶対 URL に変換する", () => {
    expect(resolvePdfUrl("/common/img/content/content_20260127_120000.pdf")).toBe(
      "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
    );
  });

  it("プロトコル相対 URL を絶対 URL に変換する", () => {
    expect(
      resolvePdfUrl(
        "//www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
      ),
    ).toBe(
      "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
    );
  });
});

describe("parseMeetingText", () => {
  it("令和の定例会を正しくパースする", () => {
    const result = parseMeetingText(
      "令和８年第１回丸森町議会定例会（２月１４日～２月２２日）",
    );
    expect(result.title).toBe("令和8年第1回丸森町議会定例会");
    expect(result.year).toBe(2026);
    expect(result.dateText).toBe("2月14日～2月22日");
    expect(result.meetingType).toBe("plenary");
  });

  it("令和の臨時会を正しくパースする", () => {
    const result = parseMeetingText(
      "令和８年第１回丸森町議会臨時会（１月２７日）",
    );
    expect(result.title).toBe("令和8年第1回丸森町議会臨時会");
    expect(result.year).toBe(2026);
    expect(result.dateText).toBe("1月27日");
    expect(result.meetingType).toBe("extraordinary");
  });

  it("令和元年に対応する", () => {
    const result = parseMeetingText(
      "令和元年第３回丸森町議会定例会（９月９日～９月１３日）",
    );
    expect(result.title).toBe("令和元年第3回丸森町議会定例会");
    expect(result.year).toBe(2019);
    expect(result.meetingType).toBe("plenary");
  });

  it("半角数字も対応する", () => {
    const result = parseMeetingText(
      "令和6年第1回丸森町議会定例会（3月5日～3月15日）",
    );
    expect(result.title).toBe("令和6年第1回丸森町議会定例会");
    expect(result.year).toBe(2024);
  });

  it("パターンに合致しない場合は null 年を返す", () => {
    const result = parseMeetingText("お知らせ");
    expect(result.year).toBeNull();
  });
});

describe("parseListPage", () => {
  it("議決結果 PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
        <h5>令和8年</h5>
        <ul>
          <li>
            <a href="../../common/img/content/content_20260127_120000.pdf">
              令和８年第１回丸森町議会臨時会（１月２７日）
            </a>
          </li>
          <li>
            <a href="../../common/img/content/content_20260315_093000.pdf">
              令和８年第１回丸森町議会定例会（２月１４日～２月２２日）
            </a>
          </li>
        </ul>
        <h5>令和7年</h5>
        <ul>
          <li>
            <a href="../../common/img/content/content_20251215_110000.pdf">
              令和７年第４回丸森町議会定例会（１２月９日～１２月１２日）
            </a>
          </li>
        </ul>
      </body>
      </html>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和8年第1回丸森町議会臨時会");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf",
    );
    expect(result[0]!.year).toBe(2026);
    expect(result[0]!.meetingType).toBe("extraordinary");

    expect(result[1]!.title).toBe("令和8年第1回丸森町議会定例会");
    expect(result[1]!.year).toBe(2026);
    expect(result[1]!.meetingType).toBe("plenary");

    expect(result[2]!.title).toBe("令和7年第4回丸森町議会定例会");
    expect(result[2]!.year).toBe(2025);
  });

  it("重複 URL を除外する", () => {
    const html = `
      <a href="../../common/img/content/content_20260127_120000.pdf">
        令和８年第１回丸森町議会臨時会（１月２７日）
      </a>
      <a href="../../common/img/content/content_20260127_120000.pdf">
        令和８年第１回丸森町議会臨時会（１月２７日）
      </a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>No links here</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("会議名が解析できないリンクはスキップする", () => {
    const html = `
      <a href="../../common/img/content/content_20260127_120000.pdf">
        お知らせ
      </a>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(0);
  });
});
