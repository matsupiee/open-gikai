import { describe, expect, it } from "vitest";
import {
  fallbackDateFromSession,
  parseDateFromFilename,
  parseYearPage,
} from "./list";

describe("parseDateFromFilename", () => {
  it("YYYYMMDD-HHMMSS パターンから日付を抽出する", () => {
    expect(parseDateFromFilename("20230222-092339")).toBe("2023-02-22");
  });

  it("別のタイムスタンプでも正しく解析する", () => {
    expect(parseDateFromFilename("20241203-143000")).toBe("2024-12-03");
  });

  it("タイムスタンプ形式でないファイル名は null を返す", () => {
    expect(parseDateFromFilename("r05-02t-02-0606")).toBeNull();
  });

  it("空文字列は null を返す", () => {
    expect(parseDateFromFilename("")).toBeNull();
  });
});

describe("fallbackDateFromSession", () => {
  it("令和の会期名から年度開始日を返す", () => {
    expect(fallbackDateFromSession("令和5年第1回定例会")).toBe("2023-01-01");
  });

  it("平成の会期名から年度開始日を返す", () => {
    expect(fallbackDateFromSession("平成30年第2回定例会")).toBe("2018-01-01");
  });

  it("和暦を含まない文字列は null を返す", () => {
    expect(fallbackDateFromSession("不明な会期")).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("会議録 PDF リンクを正しく抽出する", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td style="text-align: center;">
              <p>令和5年第1回定例会</p>
              <p>(令和5年3月定例会)</p>
            </td>
            <td>
              <p>1&nbsp;<a href="/index.cfm/9,17429,c,html/17429/20230222-092339.pdf"
                 title="令和5年第1回定例会日程表.pdf [ 74 KB pdfファイル]">
                 令和5年第1回定例会日程表.pdf [ 74 KB pdfファイル]
                 <img src="/images/icons/pdf.gif"></a></p>
              <p>2&nbsp;<a href="/index.cfm/9,17429,c,html/17429/20230301-100000.pdf"
                 title="令和5年第1回定例会会議録（開会）.pdf [ 120 KB pdfファイル]">
                 令和5年第1回定例会会議録（開会）.pdf [ 120 KB pdfファイル]
                 <img src="/images/icons/pdf.gif"></a></p>
              <p>3&nbsp;<a href="/index.cfm/9,17429,c,html/17429/20230302-100000.pdf"
                 title="令和5年第1回定例会会議録（一般質問）.pdf [ 200 KB pdfファイル]">
                 令和5年第1回定例会会議録（一般質問）.pdf [ 200 KB pdfファイル]
                 <img src="/images/icons/pdf.gif"></a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe(
      "令和5年第1回定例会 令和5年第1回定例会会議録（開会）",
    );
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.fujisaki.lg.jp/index.cfm/9,17429,c,html/17429/20230301-100000.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2023-03-01");
    expect(meetings[0]!.session).toBe("令和5年第1回定例会");
    expect(meetings[0]!.fileKey).toBe("20230301-100000");

    expect(meetings[1]!.title).toBe(
      "令和5年第1回定例会 令和5年第1回定例会会議録（一般質問）",
    );
    expect(meetings[1]!.heldOn).toBe("2023-03-02");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><p>令和5年第1回定例会</p></td>
            <td>
              <p><a href="/path/to/schedule.pdf"
                 title="令和5年第1回定例会日程表.pdf [ 74 KB pdfファイル]">
                 令和5年第1回定例会日程表.pdf [ 74 KB pdfファイル]</a></p>
              <p><a href="/path/to/gian.pdf"
                 title="令和5年第1回定例会議案目録.pdf [ 50 KB pdfファイル]">
                 令和5年第1回定例会議案目録.pdf [ 50 KB pdfファイル]</a></p>
              <p><a href="/path/to/giketsu.pdf"
                 title="令和5年第1回定例会議決結果.pdf [ 60 KB pdfファイル]">
                 令和5年第1回定例会議決結果.pdf [ 60 KB pdfファイル]</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("複数の会期を正しく処理する", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><p>令和5年第1回定例会</p></td>
            <td>
              <p><a href="/index.cfm/9,17429,c,html/17429/20230301-100000.pdf"
                 title="令和5年第1回定例会会議録（開会）.pdf [ 120 KB pdfファイル]">
                 令和5年第1回定例会会議録（開会）.pdf [ 120 KB pdfファイル]</a></p>
            </td>
          </tr>
          <tr>
            <td><p>令和5年第1回臨時会</p></td>
            <td>
              <p><a href="/index.cfm/9,17429,c,html/17429/20230501-100000.pdf"
                 title="令和5年第1回臨時会会議録.pdf [ 80 KB pdfファイル]">
                 令和5年第1回臨時会会議録.pdf [ 80 KB pdfファイル]</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.session).toBe("令和5年第1回定例会");
    expect(meetings[1]!.session).toBe("令和5年第1回臨時会");
  });

  it("タイムスタンプ形式でないファイル名ではフォールバック日付を使う", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><p>令和5年第2回定例会</p></td>
            <td>
              <p><a href="/index.cfm/9,17429,c,html/17429/r05-02t-02-0606.pdf"
                 title="令和5年第2回定例会会議録（議案審議）.pdf [ 150 KB pdfファイル]">
                 令和5年第2回定例会会議録（議案審議）.pdf [ 150 KB pdfファイル]</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-01-01");
  });

  it("title 属性が href より前にある場合も正しく抽出する", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><p>令和6年第1回定例会</p></td>
            <td>
              <p><a title="令和6年第1回定例会会議録（開会）.pdf [ 100 KB pdfファイル]"
                 href="/index.cfm/9,18933,c,html/18933/20240301-100000.pdf">
                 会議録（開会）</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
  });

  it("title 属性に会議録が含まれる場合も抽出する", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><p>令和6年第1回定例会</p></td>
            <td>
              <p><a href="/index.cfm/9,18933,c,html/18933/20240301-100000.pdf"
                 title="令和6年第1回定例会会議録（開会）.pdf [ 100 KB pdfファイル]">
                 会議録（開会）</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
  });
});
