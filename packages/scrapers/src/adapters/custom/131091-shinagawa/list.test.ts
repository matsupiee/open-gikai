import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("本文ドキュメントのみ抽出し、名簿・議事日程はスキップする", () => {
    const html = `
      <html>
      <body>
      <p>検索条件に 36 文書 (974 発言) が該当しました。</p>
      <ol>
        <li>
          <a href="https://kaigiroku.city.shinagawa.tokyo.jp/index.php/355656?Template=document&Id=6890#one">令和６年_第４回定例会（第５日目） 名簿・議事日程</a>
          2024-12-05
        </li>
        <li>
          <a href="https://kaigiroku.city.shinagawa.tokyo.jp/index.php/355656?Template=document&Id=6889#one">令和６年_第４回定例会（第５日目）　本文</a>
          2024-12-05
        </li>
        <li>
          <a href="https://kaigiroku.city.shinagawa.tokyo.jp/index.php/355656?Template=document&Id=6888#one">令和６年_第４回定例会（第４日目） 名簿・議事日程</a>
          2024-11-28
        </li>
        <li>
          <a href="https://kaigiroku.city.shinagawa.tokyo.jp/index.php/355656?Template=document&Id=6887#one">令和６年_第４回定例会（第４日目）　本文</a>
          2024-11-28
        </li>
      </ol>
      </body>
      </html>
    `;

    const { documents, totalDocuments } = parseListPage(html);

    expect(totalDocuments).toBe(36);
    expect(documents).toHaveLength(2);
    expect(documents[0]!.documentId).toBe("6889");
    expect(documents[0]!.title).toBe("令和６年_第４回定例会（第５日目） 本文");
    expect(documents[0]!.heldOn).toBe("2024-12-05");
    expect(documents[1]!.documentId).toBe("6887");
    expect(documents[1]!.heldOn).toBe("2024-11-28");
  });

  it("同じ documentId の重複を除外する", () => {
    const html = `
      <p>2 文書</p>
      <a href="/index.php/100?Template=document&Id=6889#one">定例会 本文</a> 2024-12-05
      <a href="/index.php/200?Template=document&Id=6889#one">定例会 本文</a> 2024-12-05
    `;

    const { documents } = parseListPage(html);
    expect(documents).toHaveLength(1);
  });

  it("ドキュメントが0件の場合", () => {
    const html = `<html><body><p>検索条件に 0 文書 が該当しました。</p></body></html>`;

    const { documents, totalDocuments } = parseListPage(html);
    expect(totalDocuments).toBe(0);
    expect(documents).toHaveLength(0);
  });
});
