import { describe, expect, it } from "vitest";
import { parseDetailPage, parseMeetingLinks, parseTopPage } from "./list";

describe("parseTopPage", () => {
  it("トップページから年度ページを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/www/contents/1756881938200/index.html">令和8年</a></li>
        <li><a href="/www/contents/1738293216943/index.html">令和7年</a></li>
        <li><a href="/www/contents/1710111111111/index.html">令和6年</a></li>
        <li><a href="/site/gikai/">議会トップ</a></li>
      </ul>
    `;

    const result = parseTopPage(
      html,
      "https://www.city.asakura.lg.jp/www/genre/1000000000015/index.html",
    );

    expect(result).toEqual([
      {
        label: "令和8年",
        url: "https://www.city.asakura.lg.jp/www/contents/1756881938200/index.html",
      },
      {
        label: "令和7年",
        url: "https://www.city.asakura.lg.jp/www/contents/1738293216943/index.html",
      },
      {
        label: "令和6年",
        url: "https://www.city.asakura.lg.jp/www/contents/1710111111111/index.html",
      },
    ]);
  });
});

describe("parseMeetingLinks", () => {
  it("年度ページから会議詳細ページを抽出する", () => {
    const html = `
      <div>
        <a href="/www/contents/1756882038119/index.html">令和７年第４回(６月)定例会</a>
        <a href="/www/contents/1741000000000/index.html">令和７年第１回(１月)臨時会</a>
        <a href="/www/contents/1742000000000/index.html">議会だより</a>
      </div>
    `;

    const result = parseMeetingLinks(
      html,
      "https://www.city.asakura.lg.jp/www/contents/1738293216943/index.html",
    );

    expect(result).toEqual([
      {
        title: "令和７年第４回(６月)定例会",
        url: "https://www.city.asakura.lg.jp/www/contents/1756882038119/index.html",
      },
      {
        title: "令和７年第１回(１月)臨時会",
        url: "https://www.city.asakura.lg.jp/www/contents/1741000000000/index.html",
      },
    ]);
  });
});

describe("parseDetailPage", () => {
  it("詳細ページから会議録 PDF を抽出し、日程表はスキップする", () => {
    const html = `
      <div>
        <a href="./files/nittei.pdf">議事日程表</a>
        <a href="./files/open.pdf">開会日（令和７年６月１２日）</a>
        <a href="./files/q1.pdf">一般質問（令和７年６月１７日）日野 泰信 議員</a>
        <a href="./files/q2.pdf">一般質問（令和７年６月１８日）徳永 秀俊 議員</a>
        <a href="./files/close.pdf">閉会日（令和７年６月２７日）</a>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "令和７年第４回(６月)定例会",
      "https://www.city.asakura.lg.jp/www/contents/1756882038119/index.html",
    );

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      pdfUrl: "https://www.city.asakura.lg.jp/www/contents/1756882038119/files/open.pdf",
      title: "令和７年第４回(６月)定例会 開会日",
      heldOn: "2025-06-12",
      meetingType: "plenary",
    });
    expect(result[1]?.heldOn).toBe("2025-06-17");
    expect(result[2]?.heldOn).toBe("2025-06-18");
    expect(result[3]?.heldOn).toBe("2025-06-27");
  });

  it("和暦がなくてもページタイトルの年と月日から日付を補完する", () => {
    const html = `
      <div>
        <a href="/www/contents/1756882038119/files/open.pdf">開会日 ６月１２日（木）</a>
      </div>
    `;

    const result = parseDetailPage(
      html,
      "令和７年第４回(６月)定例会",
      "https://www.city.asakura.lg.jp/www/contents/1756882038119/index.html",
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.heldOn).toBe("2025-06-12");
  });
});
