import { describe, expect, it } from "vitest";
import {
  parseCommitteeIndexPage,
  parseCommitteePage,
  parsePlenaryPage,
} from "./list";

describe("parsePlenaryPage (定例会)", () => {
  it("年度セクションから PDF リンクを抽出する", () => {
    const html = `
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/12345.pdf">第1日  11月25日 [PDF413KB]</a></p>
      <p><a href="/uploaded/attachment/12346.pdf">第2日  11月27日 [PDF512KB]</a></p>
    `;

    const result = parsePlenaryPage(
      html,
      "https://www.city.takahama.lg.jp/site/gikai/1529.html",
      "plenary",
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.takahama.lg.jp/uploaded/attachment/12345.pdf",
    );
    expect(result[0]!.meetingType).toBe("plenary");
    expect(result[0]!.heldOn).toBe("2025-11-01");
    expect(result[1]!.pdfUrl).toBe(
      "https://www.city.takahama.lg.jp/uploaded/attachment/12346.pdf",
    );
    expect(result[1]!.heldOn).toBe("2025-11-01");
  });

  it("複数の年度セクションから PDF リンクを抽出する", () => {
    const html = `
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/12345.pdf">第1日  11月25日 [PDF413KB]</a></p>
      <h3 id="r6">令和6年</h3>
      <p><a href="/uploaded/attachment/11111.pdf">第1日  12月2日 [PDF400KB]</a></p>
    `;

    const result = parsePlenaryPage(
      html,
      "https://www.city.takahama.lg.jp/site/gikai/1529.html",
      "plenary",
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2025-11-01");
    expect(result[1]!.heldOn).toBe("2024-12-01");
  });

  it("平成の年度セクションも処理する", () => {
    const html = `
      <h3 id="h30">平成30年</h3>
      <p><a href="/uploaded/attachment/5000.pdf">第1日  3月5日 [PDF300KB]</a></p>
    `;

    const result = parsePlenaryPage(
      html,
      "https://www.city.takahama.lg.jp/site/gikai/1529.html",
      "plenary",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.heldOn).toBe("2018-03-01");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("臨時会ページでは meetingType が extraordinary になる", () => {
    const html = `
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/12345.pdf">第1日  1月30日 [PDF310KB]</a></p>
    `;

    const result = parsePlenaryPage(
      html,
      "https://www.city.takahama.lg.jp/site/gikai/16707.html",
      "extraordinary",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.meetingType).toBe("extraordinary");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h3 id="r7">令和7年</h3>
      <p>会議録は準備中です。</p>
    `;

    const result = parsePlenaryPage(
      html,
      "https://www.city.takahama.lg.jp/site/gikai/1529.html",
      "plenary",
    );

    expect(result).toHaveLength(0);
  });

  it("externalId が pdfUrl から生成される", () => {
    const html = `
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/12345.pdf">第1日  11月25日 [PDF413KB]</a></p>
    `;

    const result = parsePlenaryPage(
      html,
      "https://www.city.takahama.lg.jp/site/gikai/1529.html",
      "plenary",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.externalId).toContain("takahama_");
    expect(result[0]!.externalId).toContain("12345");
  });

  it("sourceUrl がページ URL に設定される", () => {
    const html = `
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/12345.pdf">第1日  11月25日 [PDF413KB]</a></p>
    `;
    const pageUrl = "https://www.city.takahama.lg.jp/site/gikai/1529.html";

    const result = parsePlenaryPage(html, pageUrl, "plenary");

    expect(result[0]!.sourceUrl).toBe(pageUrl);
  });
});

describe("parseCommitteeIndexPage", () => {
  it("委員会の個別ページ URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/2022.html">総務建設委員会</a></li>
        <li><a href="/site/gikai/2023.html">福祉文教委員会</a></li>
      </ul>
    `;
    const indexUrl = "https://www.city.takahama.lg.jp/site/gikai/1497.html";

    const result = parseCommitteeIndexPage(html, indexUrl);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe("https://www.city.takahama.lg.jp/site/gikai/2022.html");
    expect(result[1]).toBe("https://www.city.takahama.lg.jp/site/gikai/2023.html");
  });

  it("一覧ページ自体の URL は除外する", () => {
    const html = `
      <a href="/site/gikai/1497.html">委員会 会議録一覧</a>
      <a href="/site/gikai/2022.html">総務建設委員会</a>
    `;
    const indexUrl = "https://www.city.takahama.lg.jp/site/gikai/1497.html";

    const result = parseCommitteeIndexPage(html, indexUrl);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.city.takahama.lg.jp/site/gikai/2022.html");
  });

  it("重複した URL は除外する", () => {
    const html = `
      <a href="/site/gikai/2022.html">総務建設委員会</a>
      <a href="/site/gikai/2022.html">総務建設委員会（重複）</a>
    `;
    const indexUrl = "https://www.city.takahama.lg.jp/site/gikai/1497.html";

    const result = parseCommitteeIndexPage(html, indexUrl);

    expect(result).toHaveLength(1);
  });

  it("対象外のリンクは無視する", () => {
    const html = `
      <a href="/index.html">トップ</a>
      <a href="https://example.com">外部</a>
      <a href="/site/gikai/2022.html">総務建設委員会</a>
    `;
    const indexUrl = "https://www.city.takahama.lg.jp/site/gikai/1497.html";

    const result = parseCommitteeIndexPage(html, indexUrl);

    expect(result).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = "<p>委員会の情報はありません。</p>";
    const indexUrl = "https://www.city.takahama.lg.jp/site/gikai/1497.html";

    const result = parseCommitteeIndexPage(html, indexUrl);

    expect(result).toEqual([]);
  });
});

describe("parseCommitteePage", () => {
  it("委員会個別ページから PDF リンクを抽出する", () => {
    const html = `
      <h1>総務建設委員会 会議録</h1>
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/23456.pdf">12月9日 総務建設委員会 [PDF282KB]</a></p>
    `;
    const pageUrl = "https://www.city.takahama.lg.jp/site/gikai/2022.html";

    const result = parseCommitteePage(html, pageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.city.takahama.lg.jp/uploaded/attachment/23456.pdf",
    );
    expect(result[0]!.meetingType).toBe("committee");
    expect(result[0]!.heldOn).toBe("2025-12-01");
    expect(result[0]!.sourceUrl).toBe(pageUrl);
  });

  it("リンクテキストから委員会名を抽出する", () => {
    const html = `
      <h1>委員会 会議録</h1>
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/23456.pdf">12月9日 総務建設委員会 [PDF282KB]</a></p>
    `;
    const pageUrl = "https://www.city.takahama.lg.jp/site/gikai/2022.html";

    const result = parseCommitteePage(html, pageUrl);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toContain("総務建設委員会");
  });

  it("複数年度の PDF リンクを抽出する", () => {
    const html = `
      <h1>総務建設委員会 会議録</h1>
      <h3 id="r7">令和7年</h3>
      <p><a href="/uploaded/attachment/23456.pdf">12月9日 総務建設委員会 [PDF282KB]</a></p>
      <h3 id="r6">令和6年</h3>
      <p><a href="/uploaded/attachment/22000.pdf">12月5日 総務建設委員会 [PDF250KB]</a></p>
    `;
    const pageUrl = "https://www.city.takahama.lg.jp/site/gikai/2022.html";

    const result = parseCommitteePage(html, pageUrl);

    expect(result).toHaveLength(2);
    expect(result[0]!.heldOn).toBe("2025-12-01");
    expect(result[1]!.heldOn).toBe("2024-12-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h1>委員会 会議録</h1>
      <p>準備中です。</p>
    `;
    const pageUrl = "https://www.city.takahama.lg.jp/site/gikai/2022.html";

    const result = parseCommitteePage(html, pageUrl);

    expect(result).toEqual([]);
  });
});
