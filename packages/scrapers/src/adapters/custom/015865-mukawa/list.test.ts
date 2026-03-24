import { describe, expect, it } from "vitest";
import { detectMeetingType } from "./shared";
import { extractDateFromFilename, parseEraYear, parseListPage } from "./list";

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和7年 第1回定例会")).toBe("plenary");
  });

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和7年 第2回臨時会")).toBe("extraordinary");
  });

  it("委員会を committee と判定する", () => {
    expect(detectMeetingType("総務常任委員会")).toBe("committee");
  });
});

describe("parseEraYear", () => {
  it("令和7年を2025に変換する", () => {
    expect(parseEraYear("令和7年")).toBe(2025);
  });

  it("平成30年を2018に変換する", () => {
    expect(parseEraYear("平成30年")).toBe(2018);
  });

  it("令和元年を2019に変換する", () => {
    expect(parseEraYear("令和元年")).toBe(2019);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseEraYear("会議録一覧")).toBeNull();
  });
});

describe("extractDateFromFilename", () => {
  it("8桁 YYYYMMDD パターンを変換する", () => {
    expect(extractDateFromFilename("20250310-R07-1teirei.pdf")).toBe("2025-03-10");
  });

  it("8桁 YYYYMMDD + 追加数字パターンを変換する", () => {
    expect(extractDateFromFilename("20230309-14-R05-1teirei.pdf")).toBe("2023-03-09");
  });

  it("6桁 YYMMDD パターンを変換する", () => {
    expect(extractDateFromFilename("200327-R02-2rinnji.pdf")).toBe("2020-03-27");
  });

  it("R + 6桁パターンを変換する（令和）", () => {
    expect(extractDateFromFilename("R040307-R04.1tei.pdf")).toBe("2022-03-07");
  });

  it("H + 6桁パターンを変換する（平成）", () => {
    expect(extractDateFromFilename("H300306-H30-1teirei.pdf")).toBe("2018-03-06");
  });

  it("日付部分がないファイル名はnullを返す", () => {
    expect(extractDateFromFilename("H27-1teirei.pdf")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("年度ラベルと PDF リンクを対応付ける", () => {
    const html = `
      <table>
        <tr>
          <td style="background-color: #c6d9f0">令和7年</td>
          <td style="background-color: #fdeada">
            <a href="/secure/8403/20250310-R07-1teirei.pdf">第1回定例会</a>
          </td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年 第1回定例会");
    expect(result[0]!.heldOn).toBe("2025-03-10");
    expect(result[0]!.pdfUrl).toBe(
      "http://www.town.mukawa.lg.jp/secure/8403/20250310-R07-1teirei.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.fileName).toBe("20250310-R07-1teirei.pdf");
  });

  it("同一セルに複数リンクがある場合に重複除去する", () => {
    const html = `
      <table>
        <tr>
          <td style="background-color: #c6d9f0">令和7年</td>
          <td style="background-color: #fdeada">
            <a href="/secure/8403/20250310-R07-1teirei.pdf">第1回</a>
            <a href="/secure/8403/20250310-R07-1teirei.pdf">定例会</a>
          </td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
  });

  it("複数行の年度と PDF リンクを収集する", () => {
    const html = `
      <table>
        <tr>
          <td style="background-color: #c6d9f0">令和7年</td>
          <td style="background-color: #fdeada">
            <a href="/secure/8403/20250310-R07-1teirei.pdf">第1回定例会</a>
          </td>
        </tr>
        <tr>
          <td style="background-color: #c6d9f0">令和6年</td>
          <td style="background-color: #fdeada">
            <a href="/secure/8403/20240311-R06-1teirei.pdf">第1回定例会</a>
          </td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2025-03-10");
    expect(result[1]!.heldOn).toBe("2024-03-11");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<table><tr><td>内容なし</td></tr></table>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("臨時会を extraordinary に分類する", () => {
    const html = `
      <table>
        <tr>
          <td style="background-color: #c6d9f0">令和7年</td>
          <td style="background-color: #fdeada">
            <a href="/secure/8403/20250128-R07-1rinji.pdf">第1回臨時会</a>
          </td>
        </tr>
      </table>
    `;

    const result = parseListPage(html);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });
});
