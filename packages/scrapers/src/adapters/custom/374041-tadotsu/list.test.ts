import { describe, it, expect } from "vitest";
import { parseIndexPage, parseYearPage, detectMeetingName, estimateHeldOn } from "./list";

describe("parseIndexPage", () => {
  it("年度別ページ URL と西暦年を抽出する", () => {
    const html = `
      <div>
        <ul>
          <li><a href="/choseijoho/tadotsuchogikai/kaigiroku/3720.html">令和7年（2025年）会議録</a></li>
          <li><a href="/choseijoho/tadotsuchogikai/kaigiroku/3190.html">令和6年（2024年）会議録</a></li>
          <li><a href="/choseijoho/tadotsuchogikai/kaigiroku/2872.html">令和5年（2023年）会議録</a></li>
          <li><a href="/choseijoho/tadotsuchogikai/kaigiroku/1806.html">平成25年（2013年）会議録</a></li>
        </ul>
      </div>
    `;

    const results = parseIndexPage(html);

    expect(results).toHaveLength(4);

    expect(results[0]!.year).toBe(2025);
    expect(results[0]!.url).toBe(
      "https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/3720.html"
    );

    expect(results[1]!.year).toBe(2024);
    expect(results[1]!.url).toBe(
      "https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/3190.html"
    );

    expect(results[2]!.year).toBe(2023);

    expect(results[3]!.year).toBe(2013);
    expect(results[3]!.url).toBe(
      "https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/1806.html"
    );
  });

  it("年度情報のないリンクはスキップする", () => {
    const html = `
      <div>
        <a href="/choseijoho/tadotsuchogikai/kaigiroku/3720.html">令和7年（2025年）会議録</a>
        <a href="/other/page.html">その他のページ</a>
        <a href="/choseijoho/tadotsuchogikai/kaigiroku/3190.html">令和6年（2024年）会議録</a>
      </div>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(2);
    expect(results[0]!.year).toBe(2025);
    expect(results[1]!.year).toBe(2024);
  });

  it("http:// URLをhttps:// に変換する", () => {
    const html = `
      <a href="http://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/3190.html">令和6年（2024年）会議録</a>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toMatch(/^https:\/\//);
  });

  it("リンクが存在しない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません</p></div>`;
    const results = parseIndexPage(html);
    expect(results).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("PDF リンクを抽出する", () => {
    const html = `
      <div>
        <ul>
          <li><a href="/material/files/group/13/0712gianshingi.pdf">第3回定例会 議案審議</a></li>
          <li><a href="/material/files/group/13/0712ippan.pdf">第3回定例会 一般質問</a></li>
          <li><a href="/material/files/group/13/0712teian.pdf">第3回定例会 提案説明</a></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html, 2024);

    expect(results).toHaveLength(3);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.tadotsu.kagawa.jp/material/files/group/13/0712gianshingi.pdf"
    );
    expect(results[0]!.title).toBe("第3回定例会 議案審議");
    expect(results[1]!.pdfUrl).toBe(
      "https://www.town.tadotsu.kagawa.jp/material/files/group/13/0712ippan.pdf"
    );
    expect(results[2]!.pdfUrl).toBe(
      "https://www.town.tadotsu.kagawa.jp/material/files/group/13/0712teian.pdf"
    );
  });

  it("PDF 以外のリンクはスキップする", () => {
    const html = `
      <div>
        <a href="/other/page.html">ページリンク</a>
        <a href="/material/files/group/13/0712gianshingi.pdf">会議録</a>
      </div>
    `;

    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toContain(".pdf");
  });

  it("リンクテキストが空の場合はデフォルトタイトルを使う", () => {
    const html = `
      <a href="/material/files/group/13/0712ippan.pdf">  </a>
    `;

    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("2024年 会議録");
  });

  it("PDF が存在しない場合は空配列を返す", () => {
    const html = `<div><p>準備中</p></div>`;
    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(0);
  });
});

describe("detectMeetingName", () => {
  it("臨時会を検出する", () => {
    expect(detectMeetingName("令和6年臨時会 会議録")).toBe("臨時会");
  });

  it("第1回定例会を検出する", () => {
    expect(detectMeetingName("第1回定例会 議案審議")).toBe("第1回定例会");
  });

  it("第2回定例会を検出する", () => {
    expect(detectMeetingName("第2回定例会 一般質問")).toBe("第2回定例会");
  });

  it("第3回定例会を検出する", () => {
    expect(detectMeetingName("第3回定例会 提案説明")).toBe("第3回定例会");
  });

  it("一般質問を含む場合は定例会として扱う", () => {
    expect(detectMeetingName("一般質問")).toBe("定例会 一般質問");
  });

  it("回数情報がない場合はデフォルト値を返す", () => {
    expect(detectMeetingName("会議録")).toBe("定例会");
  });
});

describe("estimateHeldOn", () => {
  it("タイトルに月情報がある場合は月を使う", () => {
    expect(estimateHeldOn("7月定例会", 2024)).toBe("2024-07-01");
  });

  it("第1回定例会は3月と推定する", () => {
    expect(estimateHeldOn("第1回定例会 議案審議", 2024)).toBe("2024-03-01");
  });

  it("第2回定例会は6月と推定する", () => {
    expect(estimateHeldOn("第2回定例会 一般質問", 2024)).toBe("2024-06-01");
  });

  it("第3回定例会は9月と推定する", () => {
    expect(estimateHeldOn("第3回定例会 提案説明", 2024)).toBe("2024-09-01");
  });

  it("第4回定例会は12月と推定する", () => {
    expect(estimateHeldOn("第4回定例会 議案審議", 2024)).toBe("2024-12-01");
  });

  it("臨時会は6月と推定する", () => {
    expect(estimateHeldOn("臨時会 会議録", 2024)).toBe("2024-06-01");
  });

  it("情報がない場合は1月を返す", () => {
    expect(estimateHeldOn("会議録", 2024)).toBe("2024-01-01");
  });
});
