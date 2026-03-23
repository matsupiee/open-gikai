import { describe, expect, it } from "vitest";
import { parseYearlyPageLinks, parseSessionLinks, parsePdfLinks } from "./list";

describe("parseYearlyPageLinks", () => {
  it("年度別一覧ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/15654.html">令和8年</a></li>
        <li><a href="/soshiki/11/13502.html">令和7年</a></li>
        <li><a href="/soshiki/11/11808.html">令和6年</a></li>
        <li><a href="/soshiki/11/9811.html">令和5年</a></li>
      </ul>
    `;

    const links = parseYearlyPageLinks(html);

    expect(links).toHaveLength(4);
    expect(links[0]!.title).toBe("令和8年");
    expect(links[0]!.url).toBe("https://www.town.kawaminami.miyazaki.jp/soshiki/11/15654.html");
    expect(links[1]!.title).toBe("令和7年");
    expect(links[2]!.title).toBe("令和6年");
    expect(links[2]!.url).toBe("https://www.town.kawaminami.miyazaki.jp/soshiki/11/11808.html");
    expect(links[3]!.title).toBe("令和5年");
  });

  it("年度名以外のリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/11808.html">令和6年</a></li>
        <li><a href="/soshiki/11/99.html">議会だより</a></li>
        <li><a href="/site/gikai/top.html">議会トップ</a></li>
      </ul>
    `;

    const links = parseYearlyPageLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("令和6年");
  });

  it("重複 URL を除外する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/11808.html">令和6年</a></li>
        <li><a href="/soshiki/11/11808.html">令和6年</a></li>
      </ul>
    `;

    const links = parseYearlyPageLinks(html);
    expect(links).toHaveLength(1);
  });

  it("平成年も抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/1010.html">平成22年</a></li>
      </ul>
    `;

    const links = parseYearlyPageLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("平成22年");
  });
});

describe("parseSessionLinks", () => {
  it("定例会・臨時会のリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/13404.html">令和6年第4回（12月）定例会・一般質問</a></li>
        <li><a href="/soshiki/11/13403.html">令和6年第4回（12月）定例会</a></li>
        <li><a href="/soshiki/11/13322.html">令和6年第3回（11月）臨時会</a></li>
      </ul>
    `;

    const links = parseSessionLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.title).toBe("令和6年第4回（12月）定例会・一般質問");
    expect(links[0]!.pageId).toBe("13404");
    expect(links[0]!.url).toBe("https://www.town.kawaminami.miyazaki.jp/soshiki/11/13404.html");
    expect(links[1]!.title).toBe("令和6年第4回（12月）定例会");
    expect(links[2]!.title).toBe("令和6年第3回（11月）臨時会");
  });

  it("会議録でないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/13403.html">令和6年第4回（12月）定例会</a></li>
        <li><a href="/soshiki/11/99.html">議会概要</a></li>
        <li><a href="/soshiki/11/88.html">委員会名簿</a></li>
      </ul>
    `;

    const links = parseSessionLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe("令和6年第4回（12月）定例会");
  });

  it("重複 pageId を除外する", () => {
    const html = `
      <ul>
        <li><a href="/soshiki/11/13403.html">令和6年第4回（12月）定例会</a></li>
        <li><a href="/soshiki/11/13403.html">令和6年第4回（12月）定例会</a></li>
      </ul>
    `;

    const links = parseSessionLinks(html);
    expect(links).toHaveLength(1);
  });
});

describe("parsePdfLinks", () => {
  it("定例会ページから PDF リンクを抽出する", () => {
    const html = `
      <div>
        <p>令和6年第4回（12月）定例会会議録</p>
        <ul>
          <li><a href="/uploaded/attachment/6544.pdf">初日</a></li>
          <li><a href="/uploaded/attachment/6545.pdf">2日目</a></li>
          <li><a href="/uploaded/attachment/6546.pdf">3日目</a></li>
          <li><a href="/uploaded/attachment/6547.pdf">最終日</a></li>
        </ul>
      </div>
    `;

    const records = parsePdfLinks(html, "令和6年第4回（12月）定例会", "13403", "https://www.town.kawaminami.miyazaki.jp/soshiki/11/13403.html");

    expect(records).toHaveLength(4);
    expect(records[0]!.pdfUrl).toBe("https://www.town.kawaminami.miyazaki.jp/uploaded/attachment/6544.pdf");
    expect(records[0]!.pdfLabel).toBe("初日");
    expect(records[0]!.title).toBe("令和6年第4回（12月）定例会");
    expect(records[0]!.pageId).toBe("13403");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[3]!.pdfLabel).toBe("最終日");
  });

  it("一般質問ページから議員名付き PDF リンクを抽出する", () => {
    const html = `
      <div>
        <ul>
          <li><a href="/uploaded/attachment/6537.pdf">内藤逸子</a></li>
          <li><a href="/uploaded/attachment/6538.pdf">蓑原敏朗</a></li>
          <li><a href="/uploaded/attachment/6539.pdf">児玉助壽</a></li>
        </ul>
      </div>
    `;

    const records = parsePdfLinks(html, "令和6年第4回（12月）定例会・一般質問", "13404", "https://www.town.kawaminami.miyazaki.jp/soshiki/11/13404.html");

    expect(records).toHaveLength(3);
    expect(records[0]!.pdfUrl).toBe("https://www.town.kawaminami.miyazaki.jp/uploaded/attachment/6537.pdf");
    expect(records[0]!.pdfLabel).toBe("内藤逸子");
    expect(records[0]!.meetingType).toBe("plenary");
  });

  it("臨時会の meetingType は extraordinary になる", () => {
    const html = `
      <div>
        <a href="/uploaded/attachment/6500.pdf">令和6年第3回（11月）臨時会</a>
      </div>
    `;

    const records = parsePdfLinks(html, "令和6年第3回（11月）臨時会", "13322", "https://www.town.kawaminami.miyazaki.jp/soshiki/11/13322.html");

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中</p></div>`;
    const records = parsePdfLinks(html, "令和6年第4回（12月）定例会", "13403", "https://www.town.kawaminami.miyazaki.jp/soshiki/11/13403.html");
    expect(records).toHaveLength(0);
  });
});
