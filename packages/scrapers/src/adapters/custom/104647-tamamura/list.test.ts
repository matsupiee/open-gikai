import { describe, expect, it } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseMeetingDate,
  parseMeetingDateFromPdfLink,
} from "./list";

describe("parseTopPage", () => {
  it("会議録トップページから年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/docs/2025052200015/">令和7年議会の会議録</a></li>
        <li><a href="/docs/2024060500025/">令和6年議会の会議録</a></li>
        <li><a href="/docs/2023061600017/">令和5年議会の会議録</a></li>
      </ul>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]!.year).toBe(2025);
    expect(result[0]!.docId).toBe("2025052200015");
    expect(result[0]!.url).toBe(
      "https://www.town.tamamura.lg.jp/docs/2025052200015/",
    );
    expect(result[1]!.year).toBe(2024);
    expect(result[2]!.year).toBe(2023);
  });

  it("平成年も解析する", () => {
    const html = `
      <ul>
        <li><a href="/docs/2019022500038/">平成30年議会の会議録</a></li>
      </ul>
    `;

    const result = parseTopPage(html);

    expect(result).toHaveLength(1);
    expect(result[0]!.year).toBe(2018);
    expect(result[0]!.docId).toBe("2019022500038");
  });

  it("会議録リンクでないものはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/docs/2025052200015/">令和7年議会の会議録</a></li>
        <li><a href="/other/page/">その他のページ</a></li>
      </ul>
    `;

    const result = parseTopPage(html);
    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>No links</p>";
    expect(parseTopPage(html)).toEqual([]);
  });
});

describe("parseMeetingDate", () => {
  it("定例会の括弧形式から月を解析する", () => {
    expect(parseMeetingDate("令和7年第4回定例会(12月議会)")).toBe("2025-12-01");
  });

  it("臨時会の括弧形式から月日を解析する", () => {
    expect(parseMeetingDate("令和7年第5回臨時会(12月22日)")).toBe("2025-12-22");
  });

  it("角括弧形式も解析する", () => {
    expect(parseMeetingDate("令和6年第4回定例会[12月議会]")).toBe("2024-12-01");
  });

  it("令和元年を解析する", () => {
    expect(parseMeetingDate("令和元年第3回定例会(9月議会)")).toBe("2019-09-01");
  });

  it("平成年も解析する", () => {
    expect(parseMeetingDate("平成30年第4回定例会(12月議会)")).toBe("2018-12-01");
  });

  it("月情報がない場合は null を返す", () => {
    expect(parseMeetingDate("令和7年第4回定例会")).toBeNull();
  });

  it("和暦なしのテキストは null を返す", () => {
    expect(parseMeetingDate("第4回定例会(12月議会)")).toBeNull();
  });

  it("1桁月もゼロパディングする", () => {
    expect(parseMeetingDate("令和7年第2回定例会(6月議会)")).toBe("2025-06-01");
  });
});

describe("parseMeetingDateFromPdfLink", () => {
  it("「第N号【M月D日】」パターンから日付を取得する", () => {
    const result = parseMeetingDateFromPdfLink(
      "第1号【12月1日】",
      "令和7年第4回定例会(12月議会)",
    );
    expect(result).toBe("2025-12-01");
  });

  it("日付パターンがない場合は null を返す", () => {
    const result = parseMeetingDateFromPdfLink(
      "議事録",
      "令和7年第4回定例会(12月議会)",
    );
    expect(result).toBeNull();
  });

  it("会議タイトルに和暦がない場合は null を返す", () => {
    const result = parseMeetingDateFromPdfLink(
      "第1号【12月1日】",
      "第4回定例会",
    );
    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクを抽出する（目次はスキップ）", () => {
    const html = `
      <table>
        <tr>
          <th colspan="3" scope="col" style="text-align: left;">令和7年第4回定例会(12月議会)</th>
        </tr>
        <tr>
          <td><a class="iconFile iconPdf" href="file_contents/teirei7_4mokuji.pdf">会議録目次[PDF：468KB]</a></td>
          <td><a class="iconFile iconPdf" href="file_contents/teirei7_1201.pdf">第1号【12月1日】[PDF：879KB]</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "2025052200015");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年第4回定例会(12月議会)");
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tamamura.lg.jp/docs/2025052200015/file_contents/teirei7_1201.pdf",
    );
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <th colspan="3" scope="col" style="text-align: left;">令和7年第5回臨時会(12月22日)</th>
        </tr>
        <tr>
          <td><a class="iconFile iconPdf" href="file_contents/rinji7_1222.pdf">第1号【12月22日】[PDF：300KB]</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "2025052200015");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和7年第5回臨時会(12月22日)");
    expect(result[0]!.meetingType).toBe("extraordinary");
    expect(result[0]!.heldOn).toBe("2025-12-22");
  });

  it("複数の会議と複数の PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <th colspan="3">令和7年第3回定例会(9月議会)</th>
        </tr>
        <tr>
          <td><a class="iconFile iconPdf" href="file_contents/teirei7_3mokuji.pdf">会議録目次</a></td>
          <td><a class="iconFile iconPdf" href="file_contents/teirei7_0902.pdf">第1号【9月2日】</a></td>
          <td><a class="iconFile iconPdf" href="file_contents/teirei7_0909.pdf">第2号【9月9日】</a></td>
        </tr>
        <tr>
          <th colspan="3">令和7年第4回定例会(12月議会)</th>
        </tr>
        <tr>
          <td><a class="iconFile iconPdf" href="file_contents/teirei7_1201.pdf">第1号【12月1日】</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "2025052200015");

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe("令和7年第3回定例会(9月議会)");
    expect(result[1]!.title).toBe("令和7年第3回定例会(9月議会)");
    expect(result[2]!.title).toBe("令和7年第4回定例会(12月議会)");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = "<p>まだ公開されていません。</p>";
    const result = parseYearPage(html, "2025052200015");
    expect(result).toEqual([]);
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <table>
        <tr>
          <th>令和7年第4回定例会(12月議会)</th>
        </tr>
        <tr>
          <td><a class="iconFile iconPdf" href="https://www.town.tamamura.lg.jp/docs/2025052200015/file_contents/teirei7_1201.pdf">第1号【12月1日】</a></td>
        </tr>
      </table>
    `;

    const result = parseYearPage(html, "2025052200015");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.tamamura.lg.jp/docs/2025052200015/file_contents/teirei7_1201.pdf",
    );
  });
});
