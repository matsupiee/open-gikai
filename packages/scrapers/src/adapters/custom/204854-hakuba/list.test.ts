import { describe, expect, it } from "vitest";
import {
  extractHeldOnFromText,
  parseHeadingYear,
  toHalfWidth,
  detectMeetingType,
} from "./shared";
import { extractSessionLabel, parseListPage, resolveUrl } from "./list";

describe("toHalfWidth", () => {
  it("全角数字を半角に変換する", () => {
    expect(toHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("令和８年")).toBe("令和8年");
  });

  it("半角数字はそのまま返す", () => {
    expect(toHalfWidth("123")).toBe("123");
  });
});

describe("parseHeadingYear", () => {
  it("（YYYY年）パターンから西暦年を取得する", () => {
    expect(parseHeadingYear("令和7年（2025年）")).toBe(2025);
    expect(parseHeadingYear("令和6年（2024年）")).toBe(2024);
  });

  it("全角括弧の（YYYY年）にも対応する", () => {
    expect(parseHeadingYear("平成31年・令和元年（2019年）")).toBe(2019);
  });

  it("和暦のみの場合もフォールバックで変換する", () => {
    expect(parseHeadingYear("令和7年")).toBe(2025);
    expect(parseHeadingYear("平成30年")).toBe(2018);
  });

  it("令和元年をフォールバック変換する", () => {
    expect(parseHeadingYear("令和元年")).toBe(2019);
  });

  it("平成元年をフォールバック変換する", () => {
    expect(parseHeadingYear("平成元年")).toBe(1989);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(parseHeadingYear("2024年")).toBeNull();
  });
});

describe("detectMeetingType", () => {
  it("定例会をplenaryと判定する", () => {
    expect(detectMeetingType("第1回定例会")).toBe("plenary");
  });

  it("臨時会をextraordinaryと判定する", () => {
    expect(detectMeetingType("第1回臨時会")).toBe("extraordinary");
  });

  it("委員会をcommitteeと判定する", () => {
    expect(detectMeetingType("予算特別委員会")).toBe("committee");
  });
});

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractHeldOnFromText("令和７年３月３日（月）午前１０時開会")).toBe(
      "2025-03-03",
    );
  });

  it("半角数字の令和日付を変換する", () => {
    expect(extractHeldOnFromText("令和7年1月20日")).toBe("2025-01-20");
  });

  it("令和元年に対応する", () => {
    expect(extractHeldOnFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractHeldOnFromText("平成30年12月10日")).toBe("2018-12-10");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("resolveUrl", () => {
  it("プロトコル相対URLにhttps:を付与する", () => {
    expect(
      resolveUrl(
        "//www.vill.hakuba.lg.jp/material/files/group/14/R7dai1teireikai_kaigiroku.pdf",
      ),
    ).toBe(
      "https://www.vill.hakuba.lg.jp/material/files/group/14/R7dai1teireikai_kaigiroku.pdf",
    );
  });

  it("絶対URLはそのまま返す", () => {
    expect(
      resolveUrl(
        "https://www.vill.hakuba.lg.jp/material/files/group/14/test.pdf",
      ),
    ).toBe("https://www.vill.hakuba.lg.jp/material/files/group/14/test.pdf");
  });
});

describe("extractSessionLabel", () => {
  it("回数を抽出する", () => {
    expect(extractSessionLabel("第1回(PDFファイル:922.1KB)")).toBe("第1回");
  });

  it("全角数字の回数を抽出する", () => {
    expect(extractSessionLabel("第３回(PDFファイル:1.5MB)")).toBe("第3回");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractSessionLabel("PDFファイル")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h2見出しとtableからPDFリンクを抽出する", () => {
    const html = `
      <h2 class="head-title" id="h_idx_iw_flex_1_0"><span class="bg"><span class="bg2">
        令和7年（2025年）
      </span></span></h2>
      <div class="wysiwyg">
        <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
          <tbody>
            <tr>
              <td style="text-align: center;">定例会</td>
              <td style="text-align: center;">臨時会</td>
            </tr>
            <tr>
              <td style="text-align: center;"><a target="_blank" class="icon2" href="//www.vill.hakuba.lg.jp/material/files/group/14/R7dai1teireikai_kaigiroku.pdf">第1回(PDFファイル:922.1KB)</a></td>
              <td style="text-align: center;"><a target="_blank" class="icon2" href="//www.vill.hakuba.lg.jp/material/files/group/14/R7dai1rinjikai_kaigiroku.pdf">第1回(PDFファイル:370.5KB)</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: "第1回定例会",
      pdfUrl:
        "https://www.vill.hakuba.lg.jp/material/files/group/14/R7dai1teireikai_kaigiroku.pdf",
      meetingType: "plenary",
      headingYear: 2025,
    });
    expect(result[1]).toEqual({
      title: "第1回臨時会",
      pdfUrl:
        "https://www.vill.hakuba.lg.jp/material/files/group/14/R7dai1rinjikai_kaigiroku.pdf",
      meetingType: "extraordinary",
      headingYear: 2025,
    });
  });

  it("臨時会がない行では定例会のみ抽出する", () => {
    const html = `
      <h2 class="head-title" id="h_idx_iw_flex_1_0"><span class="bg"><span class="bg2">
        令和7年（2025年）
      </span></span></h2>
      <div class="wysiwyg">
        <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
          <tbody>
            <tr>
              <td style="text-align: center;">定例会</td>
              <td style="text-align: center;">臨時会</td>
            </tr>
            <tr>
              <td style="text-align: center;"><a target="_blank" class="icon2" href="//www.vill.hakuba.lg.jp/material/files/group/14/R7dai2teireikai_kaigiroku.pdf">第2回(PDFファイル:949.5KB)</a></td>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("第2回定例会");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("複数年度のテーブルを正しく紐付ける", () => {
    const html = `
      <h2 class="head-title" id="h_idx_iw_flex_1_0"><span class="bg"><span class="bg2">
        令和7年（2025年）
      </span></span></h2>
      <div class="wysiwyg">
        <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
          <tbody>
            <tr><td style="text-align: center;">定例会</td><td style="text-align: center;">臨時会</td></tr>
            <tr>
              <td style="text-align: center;"><a href="//www.vill.hakuba.lg.jp/material/files/group/14/R7dai1teireikai_kaigiroku.pdf">第1回(PDFファイル:922.1KB)</a></td>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2 class="head-title" id="h_idx_iw_flex_1_1"><span class="bg"><span class="bg2">
        令和6年（2024年）
      </span></span></h2>
      <div class="wysiwyg">
        <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
          <tbody>
            <tr><td style="text-align: center;">定例会</td><td style="text-align: center;">臨時会</td></tr>
            <tr>
              <td style="text-align: center;"><a href="//www.vill.hakuba.lg.jp/material/files/group/14/R6dai1teireikai_kaigiroku.pdf">第1回(PDFファイル:2.1MB)</a></td>
              <td style="text-align: center;"><a href="//www.vill.hakuba.lg.jp/material/files/group/14/R6dai1rinjikai.pdf">第1回(PDFファイル:330.8KB)</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.headingYear).toBe(2025);
    expect(result[0]!.title).toBe("第1回定例会");
    expect(result[1]!.headingYear).toBe(2024);
    expect(result[1]!.title).toBe("第1回定例会");
    expect(result[2]!.headingYear).toBe(2024);
    expect(result[2]!.title).toBe("第1回臨時会");
    expect(result[2]!.meetingType).toBe("extraordinary");
  });

  it("PDFリンクがない場合は空配列を返す", () => {
    const html = "<p>会議録はありません</p>";
    expect(parseListPage(html)).toEqual([]);
  });

  it("平成の年度見出しも正しく変換する", () => {
    const html = `
      <h2 class="head-title" id="h_idx_iw_flex_1_15"><span class="bg"><span class="bg2">
        平成22年（2010年）
      </span></span></h2>
      <div class="wysiwyg">
        <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
          <tbody>
            <tr><td style="text-align: center;">定例会</td><td style="text-align: center;">臨時会</td></tr>
            <tr>
              <td style="text-align: center;"><a href="//www.vill.hakuba.lg.jp/material/files/group/14/1003_teirei.pdf">第1回(PDFファイル:500KB)</a></td>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.headingYear).toBe(2010);
    expect(result[0]!.title).toBe("第1回定例会");
  });

  it("複数行のデータ行を全て抽出する", () => {
    const html = `
      <h2 class="head-title" id="h_idx_iw_flex_1_0"><span class="bg"><span class="bg2">
        令和7年（2025年）
      </span></span></h2>
      <div class="wysiwyg">
        <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
          <tbody>
            <tr>
              <td style="text-align: center;">定例会</td>
              <td style="text-align: center;">臨時会</td>
            </tr>
            <tr>
              <td style="text-align: center;"><a href="//host/R7dai1teireikai.pdf">第1回(PDFファイル:922.1KB)</a></td>
              <td style="text-align: center;"><a href="//host/R7dai1rinjikai.pdf">第1回(PDFファイル:370.5KB)</a></td>
            </tr>
            <tr>
              <td style="text-align: center;"><a href="//host/R7dai2teireikai.pdf">第2回(PDFファイル:949.5KB)</a></td>
              <td>&nbsp;</td>
            </tr>
            <tr>
              <td style="text-align: center;"><a href="//host/R7dai3teireikai.pdf">第3回(PDFファイル:1.5MB)</a></td>
              <td>&nbsp;</td>
            </tr>
            <tr>
              <td style="text-align: center;"><a href="//host/R7dai4teireikai.pdf">第4回(PDFファイル:1.5MB)</a></td>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(5);
    expect(result[0]!.title).toBe("第1回定例会");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[1]!.title).toBe("第1回臨時会");
    expect(result[1]!.meetingType).toBe("extraordinary");
    expect(result[2]!.title).toBe("第2回定例会");
    expect(result[3]!.title).toBe("第3回定例会");
    expect(result[4]!.title).toBe("第4回定例会");
  });
});
