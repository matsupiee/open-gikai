import { describe, expect, it } from "vitest";
import { parseMinutesLinks, parseSessionInfo } from "./list";

describe("parseMinutesLinks", () => {
  it("会議録セクションの PDF リンクを抽出する", () => {
    const html = `
      <html>
      <body>
      <h2>提出議案など</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/gian.pdf">提出議案</a></p>
      <h2>会議録</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_rinnji_kaigiroku.pdf">
        令和7年_第4回（12月）上牧町臨時会会議録 (PDFファイル: 263.3KB)
      </a></p>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_teirei_kaigiroku.pdf">
        令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
      </a></p>
      <h2>議会だより</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/dayori.pdf">議会だより</a></p>
      </body>
      </html>
    `;

    const records = parseMinutesLinks(html);

    expect(records).toHaveLength(2);
    expect(records[0]!.pdfUrl).toBe(
      "https://www.town.kanmaki.nara.jp/material/files/group/17/R07_12_rinnji_kaigiroku.pdf",
    );
    expect(records[0]!.meetingType).toBe("extraordinary");
    expect(records[0]!.heldOn).toBe("2025-12-01");
    expect(records[1]!.pdfUrl).toBe(
      "https://www.town.kanmaki.nara.jp/material/files/group/17/R07_12_teirei_kaigiroku.pdf",
    );
    expect(records[1]!.meetingType).toBe("plenary");
    expect(records[1]!.heldOn).toBe("2025-12-01");
  });

  it("会議録セクション以外の PDF リンクを除外する", () => {
    const html = `
      <html>
      <body>
      <h2>提出議案など</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/gian.pdf">提出議案</a></p>
      <h2>会議録</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_teirei_kaigiroku.pdf">
        令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
      </a></p>
      </body>
      </html>
    `;

    const records = parseMinutesLinks(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("plenary");
  });

  it("重複 PDF URL を除外する", () => {
    const html = `
      <h2>会議録</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_teirei_kaigiroku.pdf">
        令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
      </a></p>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_teirei_kaigiroku.pdf">
        令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
      </a></p>
    `;

    const records = parseMinutesLinks(html);
    expect(records).toHaveLength(1);
  });

  it("会議録セクションがない場合は空配列を返す", () => {
    const html = `<html><body><h2>提出議案など</h2></body></html>`;
    const records = parseMinutesLinks(html);
    expect(records).toHaveLength(0);
  });

  it("令和6年の議会あり表記を正しくパースする", () => {
    const html = `
      <h2>会議録</h2>
      <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R609teirei_kaigiroku.pdf">
        令和6年_第3回（9月）上牧町議会定例会会議録 (PDFファイル: 5.1MB)
      </a></p>
    `;

    const records = parseMinutesLinks(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBe("2024-09-01");
    expect(records[0]!.meetingType).toBe("plenary");
  });
});

describe("parseSessionInfo", () => {
  it("令和7年定例会をパースする（アンダースコアなし）", () => {
    const result = parseSessionInfo(
      "令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)",
    );
    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年第4回（12月）上牧町定例会会議録");
    expect(result!.heldOn).toBe("2025-12-01");
    expect(result!.meetingType).toBe("plenary");
  });

  it("令和7年臨時会をパースする（アンダースコアあり）", () => {
    const result = parseSessionInfo(
      "令和7年_第4回（12月）上牧町臨時会会議録 (PDFファイル: 263.3KB)",
    );
    expect(result).not.toBeNull();
    expect(result!.title).toBe("令和7年_第4回（12月）上牧町臨時会会議録");
    expect(result!.heldOn).toBe("2025-12-01");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("令和6年の議会あり表記をパースする", () => {
    const result = parseSessionInfo(
      "令和6年_第3回（9月）上牧町議会定例会会議録 (PDFファイル: 5.1MB)",
    );
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-09-01");
    expect(result!.meetingType).toBe("plenary");
  });

  it("平成31年をパースする", () => {
    const result = parseSessionInfo(
      "平成31年第1回（3月）上牧町議会定例会会議録 (PDFファイル: 1.2MB)",
    );
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2019-03-01");
    expect(result!.meetingType).toBe("plenary");
  });

  it("パターンに合致しないテキストは null を返す", () => {
    const result = parseSessionInfo("議会だより第41号");
    expect(result).toBeNull();
  });

  it("空文字列は null を返す", () => {
    const result = parseSessionInfo("");
    expect(result).toBeNull();
  });
});
