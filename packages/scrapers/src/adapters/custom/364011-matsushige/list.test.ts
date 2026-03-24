import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("h2/h3/a タグから PDF レコードを抽出する", () => {
    const html = `
      <div>
        <h2>令和７年</h2>
        <h3>第４回定例会</h3>
        <p><a href="file_contents/202512.pdf">令和７年第４回定例会会議録目次[PDF：150KB]</a></p>
        <p><a href="file_contents/20251204.pdf">令和７年第４回定例会　１２月４日[PDF：500KB]</a></p>
        <p><a href="file_contents/20251208.pdf">令和７年第４回定例会　１２月８日[PDF：480KB]</a></p>
      </div>
    `;

    const results = parseListPage(html);

    // 目次 PDF は除外される
    expect(results).toHaveLength(2);

    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.matsushige.tokushima.jp/file_contents/20251204.pdf"
    );
    expect(results[0]!.heldOn).toBe("2025-12-04");
    expect(results[0]!.meetingType).toBe("plenary");

    expect(results[1]!.pdfUrl).toBe(
      "https://www.town.matsushige.tokushima.jp/file_contents/20251208.pdf"
    );
    expect(results[1]!.heldOn).toBe("2025-12-08");
  });

  it("臨時会は extraordinary になる", () => {
    const html = `
      <div>
        <h2>令和６年</h2>
        <h3>第２回臨時会</h3>
        <p><a href="file_contents/r6rinjikai.pdf">令和６年第２回臨時会　３月１日[PDF：200KB]</a></p>
      </div>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.meetingType).toBe("extraordinary");
    expect(results[0]!.heldOn).toBe("2024-03-01");
  });

  it("年度フィルタを適用する", () => {
    const html = `
      <div>
        <h2>令和７年</h2>
        <h3>第１回定例会</h3>
        <p><a href="file_contents/r7-1.pdf">令和７年第１回定例会　３月５日[PDF：400KB]</a></p>
        <h2>令和６年</h2>
        <h3>第４回定例会</h3>
        <p><a href="file_contents/r6-4.pdf">令和６年第４回定例会　１２月６日[PDF：450KB]</a></p>
      </div>
    `;

    const results2025 = parseListPage(html, 2025);
    const results2024 = parseListPage(html, 2024);
    const resultsAll = parseListPage(html);

    expect(results2025).toHaveLength(1);
    expect(results2025[0]!.heldOn).toBe("2025-03-05");

    expect(results2024).toHaveLength(1);
    expect(results2024[0]!.heldOn).toBe("2024-12-06");

    expect(resultsAll).toHaveLength(2);
  });

  it("令和元年を 2019 年に変換する", () => {
    const html = `
      <div>
        <h2>令和元年</h2>
        <h3>第１回定例会</h3>
        <p><a href="file_contents/r1-1.pdf">令和元年第１回定例会　３月４日[PDF：300KB]</a></p>
      </div>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.heldOn).toBe("2019-03-04");
  });

  it("平成の年を変換する", () => {
    const html = `
      <div>
        <h2>平成２５年</h2>
        <h3>第３回定例会</h3>
        <p><a href="file_contents/1409.pdf">平成２５年第３回定例会　９月９日[PDF：600KB]</a></p>
      </div>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.heldOn).toBe("2013-09-09");
  });

  it("目次 PDF を除外する", () => {
    const html = `
      <div>
        <h2>令和６年</h2>
        <h3>第３回定例会</h3>
        <p><a href="file_contents/202509.pdf">令和６年第３回定例会会議録目次[PDF：100KB]</a></p>
        <p><a href="file_contents/20250901.pdf">令和６年第３回定例会　９月１日[PDF：400KB]</a></p>
      </div>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toContain("20250901.pdf");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><h2>令和７年</h2><p>準備中</p></div>`;

    const results = parseListPage(html);
    expect(results).toEqual([]);
  });

  it("[PDF：○○KB] のサイズ表記を除去する", () => {
    const html = `
      <div>
        <h2>令和６年</h2>
        <h3>第１回定例会</h3>
        <p><a href="file_contents/20240304.pdf">令和６年第１回定例会　３月４日[PDF：1.2MB]</a></p>
      </div>
    `;

    const results = parseListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).not.toContain("[PDF");
    expect(results[0]!.heldOn).toBe("2024-03-04");
  });
});
