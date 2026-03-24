import { describe, expect, it } from "vitest";
import {
  extractGeneralQuestions,
  extractHeldOn,
  extractMeetingTitle,
  extractResolutions,
  parsePageStatements,
} from "./detail";

describe("extractMeetingTitle", () => {
  it("h1 タグから会議タイトルを取得する", () => {
    const html = `
      <html>
        <head><title>令和6年第6回定例会（12月） | 下市町</title></head>
        <body>
          <h1>令和6年第6回定例会（12月）</h1>
        </body>
      </html>
    `;

    expect(extractMeetingTitle(html)).toBe("令和6年第6回定例会（12月）");
  });

  it("h1 がない場合は title タグから取得する", () => {
    const html = `
      <html>
        <head><title>令和6年第6回定例会（12月） | 下市町</title></head>
        <body><p>内容</p></body>
      </html>
    `;

    expect(extractMeetingTitle(html)).toBe("令和6年第6回定例会（12月）");
  });

  it("会議名が存在しない場合は null を返す", () => {
    const html = `
      <html>
        <head><title>下市町</title></head>
        <body><h1>お知らせ</h1></body>
      </html>
    `;

    expect(extractMeetingTitle(html)).toBeNull();
  });

  it("平成の会議タイトルも取得できる", () => {
    const html = `<h1>平成30年第4回定例会</h1>`;
    expect(extractMeetingTitle(html)).toBe("平成30年第4回定例会");
  });
});

describe("extractHeldOn", () => {
  it("ページ本文中の完全な和暦日付から開催日を取得する", () => {
    const html = `
      <h1>令和6年第6回定例会（12月）</h1>
      <p>会期　令和6年12月3日～9日</p>
    `;

    expect(extractHeldOn(html, "令和6年第6回定例会（12月）")).toBe("2024-12-03");
  });

  it("平成の日付も正しく変換する", () => {
    const html = `
      <h1>平成30年第4回定例会</h1>
      <p>会期　平成30年6月14日～20日</p>
    `;

    expect(extractHeldOn(html, "平成30年第4回定例会")).toBe("2018-06-14");
  });

  it("令和元年の日付も正しく変換する", () => {
    const html = `
      <h1>令和元年第6回定例会（12月）</h1>
      <p>会期　令和元年12月6日</p>
    `;

    expect(extractHeldOn(html, "令和元年第6回定例会")).toBe("2019-12-06");
  });

  it("完全な和暦日付がない場合は月日だけから組み立てる", () => {
    const html = `
      <h1>令和6年第6回定例会（12月）</h1>
      <p>会期 12月3日</p>
    `;

    expect(extractHeldOn(html, "令和6年第6回定例会（12月）")).toBe("2024-12-03");
  });

  it("年も月日も取得できない場合は null を返す", () => {
    const html = `<h1>下市町議会について</h1><p>活動状況</p>`;
    expect(extractHeldOn(html, "議会について")).toBeNull();
  });
});

describe("extractResolutions", () => {
  it("議案番号と件名を含む行を抽出する", () => {
    const html = `
      <table>
        <tr><td>議案第1号</td><td>下市町火災予防条例の一部改正</td><td>原案可決</td></tr>
        <tr><td>議案第2号</td><td>令和6年度一般会計補正予算</td><td>原案可決</td></tr>
      </table>
    `;

    const resolutions = extractResolutions(html);
    expect(resolutions.length).toBeGreaterThan(0);
    expect(resolutions.some((r) => r.includes("議案第1号"))).toBe(true);
  });

  it("議案がない場合は空配列を返す", () => {
    const html = `<p>一般質問</p><p>行財政改革について</p>`;
    const resolutions = extractResolutions(html);
    expect(resolutions).toHaveLength(0);
  });

  it("複数の議案を正しく抽出する", () => {
    const plainText = `
議決事項

議案第1号　下市町火災予防条例の一部改正について　原案可決
議案第2号　令和6年度下市町一般会計補正予算について　原案可決
議案第3号　令和6年度下市町水道事業会計補正予算について　原案可決
    `;
    const html = `<div>${plainText}</div>`;

    const resolutions = extractResolutions(html);
    expect(resolutions.length).toBeGreaterThanOrEqual(3);
  });
});

describe("extractGeneralQuestions", () => {
  it("一般質問セクションからテーマを抽出する", () => {
    const html = `
      <div>
        <h3>一般質問</h3>
        <p>高齢者福祉の充実について</p>
        <p>地域防災計画の見直しについて</p>
      </div>
    `;

    const questions = extractGeneralQuestions(html);
    expect(questions.length).toBeGreaterThan(0);
  });

  it("一般質問がない場合は空配列を返す", () => {
    const html = `
      <div>
        <h3>議決事項</h3>
        <p>議案第1号　条例改正</p>
      </div>
    `;

    const questions = extractGeneralQuestions(html);
    expect(questions).toHaveLength(0);
  });
});

describe("parsePageStatements", () => {
  it("議決事項と一般質問を ParsedStatement に変換する", () => {
    const html = `
      <div>
        <h3>議決事項</h3>
        <p>議案第1号　下市町火災予防条例の一部改正について　原案可決</p>
        <h3>一般質問</h3>
        <p>高齢者福祉の充実について</p>
      </div>
    `;

    const statements = parsePageStatements(html);
    expect(statements.length).toBeGreaterThan(0);

    // 議決事項は remark
    const remarkStatements = statements.filter((s) => s.kind === "remark");
    expect(remarkStatements.length).toBeGreaterThan(0);
    expect(remarkStatements[0]!.content).toContain("議案第1号");

    // 各 statement に contentHash が付与される
    for (const stmt of statements) {
      expect(stmt.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("offset が正しく計算される", () => {
    const html = `<div>議案第1号　条例改正について　可決</div>`;

    const statements = parsePageStatements(html);
    if (statements.length > 0) {
      expect(statements[0]!.startOffset).toBe(0);
      expect(statements[0]!.endOffset).toBeGreaterThan(0);
    }
  });

  it("議決事項も一般質問もない場合は空配列を返す", () => {
    const html = `<p>お知らせページ</p>`;
    expect(parsePageStatements(html)).toHaveLength(0);
  });
});
