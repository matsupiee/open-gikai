import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractHeldOn,
  extractMeetingTitle,
  extractResolutionRows,
  normalizeMeetingTitle,
  parsePageStatements,
} from "./detail";

describe("normalizeMeetingTitle", () => {
  it("「の結果について」を取り除く", () => {
    expect(normalizeMeetingTitle("令和6年3月葛尾村議会定例会の結果について")).toBe(
      "令和6年3月葛尾村議会定例会",
    );
  });

  it("サイト名の接尾辞を取り除く", () => {
    expect(normalizeMeetingTitle("令和6年第1回葛尾村議会臨時会の結果について - 葛尾村ホームページ")).toBe(
      "令和6年第1回葛尾村議会臨時会",
    );
  });
});

describe("extractMeetingTitle", () => {
  it("h1 から会議名を抽出する", () => {
    const html = `
      <html>
        <body>
          <h1>令和6年3月葛尾村議会定例会の結果について</h1>
        </body>
      </html>
    `;

    expect(extractMeetingTitle(html)).toBe("令和6年3月葛尾村議会定例会");
  });

  it("h1 がない場合は title と fallback から抽出する", () => {
    const html = `
      <html>
        <head>
          <title>令和6年第1回葛尾村議会臨時会の結果について - 葛尾村ホームページ</title>
        </head>
        <body></body>
      </html>
    `;

    expect(extractMeetingTitle(html, "令和6年第1回葛尾村議会臨時会の結果について")).toBe(
      "令和6年第1回葛尾村議会臨時会",
    );
  });

  it("会議名が見つからない場合は null を返す", () => {
    const html = `
      <html>
        <body>
          <h1>議会だより</h1>
        </body>
      </html>
    `;

    expect(extractMeetingTitle(html)).toBeNull();
  });
});

describe("extractHeldOn", () => {
  it("会期の開始日を抽出する", () => {
    const html = `
      <div class="detail_free">
        <ul>
          <li>会期　令和6年3月8日～14日　(7日間)</li>
        </ul>
      </div>
    `;

    expect(extractHeldOn(html, "令和6年3月葛尾村議会定例会")).toBe("2024-03-08");
  });

  it("単日の会期も抽出する", () => {
    const html = `
      <div class="detail_free">
        <ul>
          <li>会期　令和6年1月17日</li>
        </ul>
      </div>
    `;

    expect(extractHeldOn(html, "令和6年第1回葛尾村議会臨時会")).toBe("2024-01-17");
  });

  it("年が本文になくても title の年で補完する", () => {
    const html = `
      <div class="detail_free">
        <ul>
          <li>会期　3月8日～14日</li>
        </ul>
      </div>
    `;

    expect(extractHeldOn(html, "令和6年3月葛尾村議会定例会")).toBe("2024-03-08");
  });

  it("会期が見つからない場合は null を返す", () => {
    expect(extractHeldOn("<p>お知らせ</p>", "令和6年3月葛尾村議会定例会")).toBeNull();
  });
});

describe("extractResolutionRows", () => {
  it("議決結果テーブルから各行を抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>議案番号</td>
          <td>件名</td>
          <td>議決月日</td>
          <td>議決結果</td>
        </tr>
        <tr>
          <td>承認第1号</td>
          <td>令和5年度葛尾村一般会計補正予算（第6号）に係る専決処分の承認を求めることについて</td>
          <td>3月14日</td>
          <td>承認</td>
        </tr>
        <tr>
          <td>議案第4号​</td>
          <td>葛尾村手話言語条例の制定について</td>
          <td>3月14日​</td>
          <td>原案可決​</td>
        </tr>
      </table>
    `;

    const rows = extractResolutionRows(html);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(
      "承認第1号 令和5年度葛尾村一般会計補正予算（第6号）に係る専決処分の承認を求めることについて 3月14日 承認",
    );
    expect(rows[1]).toBe(
      "議案第4号 葛尾村手話言語条例の制定について 3月14日 原案可決",
    );
  });

  it("テーブルがない場合は空配列を返す", () => {
    expect(extractResolutionRows("<p>結果はありません</p>")).toEqual([]);
  });
});

describe("parsePageStatements", () => {
  it("議決結果行を remark statement に変換する", () => {
    const html = `
      <table>
        <tr>
          <td>議案番号</td>
          <td>件名</td>
          <td>議決月日</td>
          <td>議決結果</td>
        </tr>
        <tr>
          <td>議案第1号</td>
          <td>葛尾村手話言語条例の制定について</td>
          <td>3月17日</td>
          <td>原案可決</td>
        </tr>
        <tr>
          <td>議案第2号</td>
          <td>葛尾村再生賃貸住宅条例の制定について</td>
          <td>3月17日</td>
          <td>原案可決</td>
        </tr>
      </table>
    `;

    const statements = parsePageStatements(html);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.content).toBe(
      "議案第1号 葛尾村手話言語条例の制定について 3月17日 原案可決",
    );
    expect(statements[0]!.contentHash).toBe(
      createHash("sha256")
        .update("議案第1号 葛尾村手話言語条例の制定について 3月17日 原案可決")
        .digest("hex"),
    );
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.startOffset).toBe(
      "議案第1号 葛尾村手話言語条例の制定について 3月17日 原案可決".length + 1,
    );
  });

  it("議決結果がない場合は空配列を返す", () => {
    expect(parsePageStatements("<p>お知らせ</p>")).toEqual([]);
  });
});
