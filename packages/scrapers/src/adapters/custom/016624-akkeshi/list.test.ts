import { describe, it, expect } from "vitest";
import { parseYearPage } from "./list";

const R6_HTML = `
<h2>令和6年</h2>

<h3>令和6年第1回臨時会</h3>
<h5>会期：令和6年1月26日</h5>
<h4>本会議</h4>
<ul>
  <li><a href="/file/contents/3869/44926/r060126-rinjihonnkaigi.pdf">1月26日</a>(PDF形式：199KB)</li>
</ul>

<h3>令和6年第1回定例会</h3>
<h5>会期：令和6年3月6日～13日</h5>
<h4>本会議</h4>
<ul>
  <li><a href="/file/contents/3869/44862/r060306-honnkaigi.pdf">3月6日</a>(PDF形式：13MB)</li>
  <li><a href="/file/contents/3869/44862/r060307-honnkaigi.pdf">3月7日</a>(PDF形式：459KB)</li>
  <li><a href="/file/contents/3869/44862/r060313-honnkaigi.pdf">3月13日</a>(PDF形式：133KB)</li>
</ul>
<h4>予算審査特別委員会</h4>
<ul>
  <li><a href="/file/contents/3869/44864/r060308-yosan.pdf">3月8日</a>(PDF形式：500KB)</li>
</ul>
<h4>補正予算審査特別委員会</h4>
<ul>
  <li><a href="/file/contents/3869/44866/r060311-hosei.pdf">3月11日</a>(PDF形式：300KB)</li>
</ul>
`;

describe("parseYearPage", () => {
  it("セッション名・会議種別・PDF URL を正しく抽出する", () => {
    const meetings = parseYearPage(R6_HTML, 2024);

    expect(meetings.length).toBe(6);

    // 臨時会
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.akkeshi-town.jp/file/contents/3869/44926/r060126-rinjihonnkaigi.pdf",
    );
    expect(meetings[0]!.title).toBe("令和6年第1回臨時会 本会議");
    expect(meetings[0]!.heldOn).toBe("2024-01-26");
    expect(meetings[0]!.sessionName).toBe("令和6年第1回臨時会");
    expect(meetings[0]!.category).toBe("本会議");

    // 定例会本会議
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.akkeshi-town.jp/file/contents/3869/44862/r060306-honnkaigi.pdf",
    );
    expect(meetings[1]!.title).toBe("令和6年第1回定例会 本会議");
    expect(meetings[1]!.heldOn).toBe("2024-03-06");

    // 予算審査特別委員会
    expect(meetings[4]!.title).toBe("令和6年第1回定例会 予算審査特別委員会");
    expect(meetings[4]!.heldOn).toBe("2024-03-08");
    expect(meetings[4]!.category).toBe("予算審査特別委員会");

    // 補正予算審査特別委員会
    expect(meetings[5]!.title).toBe("令和6年第1回定例会 補正予算審査特別委員会");
    expect(meetings[5]!.heldOn).toBe("2024-03-11");
  });

  it("重複する PDF URL は除外する", () => {
    const html = `
      <h3>令和6年第1回定例会</h3>
      <h4>本会議</h4>
      <ul>
        <li><a href="/file/contents/100/200/test.pdf">3月6日</a></li>
        <li><a href="/file/contents/100/200/test.pdf">3月6日</a></li>
      </ul>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings.length).toBe(1);
  });

  it("日付の無いリンクテキストはスキップする", () => {
    const html = `
      <h3>令和6年第1回定例会</h3>
      <h4>本会議</h4>
      <ul>
        <li><a href="/file/contents/100/200/test.pdf">会議録一覧</a></li>
      </ul>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings.length).toBe(0);
  });

  it("令和元年・平成31年が混在するページをパースする", () => {
    const html = `
      <h3>令和元年第4回定例会</h3>
      <h4>本会議</h4>
      <ul>
        <li><a href="/file/contents/2275/26036/12_11.pdf">12月11日</a>(PDF形式：100KB)</li>
      </ul>
      <h3>平成31年第1回定例会</h3>
      <h4>本会議</h4>
      <ul>
        <li><a href="/file/contents/2275/26013/3_6.pdf">3月6日</a>(PDF形式：100KB)</li>
      </ul>
    `;
    const meetings = parseYearPage(html, 2019);

    expect(meetings.length).toBe(2);
    expect(meetings[0]!.heldOn).toBe("2019-12-11");
    expect(meetings[0]!.sessionName).toBe("令和元年第4回定例会");
    expect(meetings[1]!.heldOn).toBe("2019-03-06");
    expect(meetings[1]!.sessionName).toBe("平成31年第1回定例会");
  });

  it("h4 が無い場合はカテゴリを「本会議」とする", () => {
    const html = `
      <h3>令和6年第1回臨時会</h3>
      <ul>
        <li><a href="/file/contents/100/200/test.pdf">1月26日</a>(PDF形式：199KB)</li>
      </ul>
    `;
    const meetings = parseYearPage(html, 2024);
    expect(meetings.length).toBe(1);
    expect(meetings[0]!.category).toBe("本会議");
  });

  it("R07 形式のファイル名も正しく抽出する", () => {
    const html = `
      <h3>令和7年第1回定例会</h3>
      <h4>本会議</h4>
      <ul>
        <li><a href="/file/contents/3938/48520/R07-1honkaigi0305.pdf">3月5日</a>(PDF形式：400KB)</li>
      </ul>
      <h4>条例審査特別委員会</h4>
      <ul>
        <li><a href="/file/contents/3938/48526/R7-01jourei0306.pdf">3月6日</a>(PDF形式：300KB)</li>
      </ul>
    `;
    const meetings = parseYearPage(html, 2025);

    expect(meetings.length).toBe(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.akkeshi-town.jp/file/contents/3938/48520/R07-1honkaigi0305.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2025-03-05");
    expect(meetings[1]!.category).toBe("条例審査特別委員会");
  });
});
