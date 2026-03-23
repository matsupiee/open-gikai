import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("定例会と臨時会の行を抽出する", () => {
    const html = `
      <table border="1" cellpadding="1" cellspacing="1">
        <tbody>
          <tr>
            <td style="text-align: center;">名称</td>
            <td style="text-align: center;">ファイル</td>
          </tr>
          <tr>
            <td><span style="font-size: 15.488px;">令和7年第7回階上町議会臨時会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/20260210-163525.pdf" title="令和7年第7回臨時会"><img alt="" src="/images/icons/pdf.gif">令和7年第7回臨時会　階上町議会会議録</a></td>
          </tr>
          <tr>
            <td><span style="font-size: 15.488px;">令和7年第6回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/20251201-100000.pdf" title="令和7年第6回定例会"><img alt="" src="/images/icons/pdf.gif">令和7年第6回定例会　階上町議会会議録</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.title).toBe("令和7年第7回階上町議会臨時会");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hashikami.lg.jp/index.cfm/9,11528,c,html/11528/20260210-163525.pdf"
    );
    expect(meetings[0]!.year).toBe(2025);

    expect(meetings[1]!.title).toBe("令和7年第6回階上町議会定例会");
    expect(meetings[1]!.year).toBe(2025);
  });

  it("ヘッダー行をスキップする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td style="text-align: center;">名称</td>
            <td style="text-align: center;">ファイル</td>
          </tr>
          <tr>
            <td><span>令和6年第1回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/1.pdf"><img alt="" src="/images/icons/pdf.gif">会議録</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年第1回階上町議会定例会");
  });

  it("発言訂正申出書をスキップする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td style="text-align: center;">名称</td>
            <td style="text-align: center;">ファイル</td>
          </tr>
          <tr>
            <td><span>令和7年第6回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/1.pdf"><img alt="" src="/images/icons/pdf.gif">会議録</a></td>
          </tr>
          <tr>
            <td><span>令和7年第1回定例会における発言訂正申出書</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/2.pdf"><img alt="" src="/images/icons/pdf.gif">申出書</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和7年第6回階上町議会定例会");
  });

  it("平成の会議録を正しくパースする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><span>平成20年第3回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/3.pdf"><img alt="" src="/images/icons/pdf.gif">会議録</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2008);
  });

  it("平成元年をパースする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><span>平成元年第1回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/4.pdf"><img alt="" src="/images/icons/pdf.gif">会議録</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(1989);
  });

  it("PDF リンクがない行をスキップする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><span>令和7年第1回階上町議会定例会</span></td>
            <td>準備中</td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });

  it("URL 末尾の全角スペースをトリムする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><span>令和6年第2回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/20241004-114718.pdf　"><img alt="" src="/images/icons/pdf.gif">会議録</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.hashikami.lg.jp/index.cfm/9,11528,c,html/11528/20241004-114718.pdf"
    );
  });

  it("定例会・臨時会を含まない行をスキップする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <td><span>令和7年第6回階上町議会定例会</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/1.pdf"><img alt="" src="/images/icons/pdf.gif">会議録</a></td>
          </tr>
          <tr>
            <td><span>階上町議会だより</span></td>
            <td><a href="/index.cfm/9,11528,c,html/11528/2.pdf"><img alt="" src="/images/icons/pdf.gif">議会だより</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
  });
});
