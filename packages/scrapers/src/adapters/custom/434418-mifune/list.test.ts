import { describe, expect, it } from "vitest";
import { parseListPage, hasNextPage, parseDetailPage } from "./list";

describe("parseListPage", () => {
  it("詳細ページへのリンクを抽出する", () => {
    const html = `
      <div class="listBox">
        <ul>
          <li>
            <a href="/gikai/page8722.html">令和6年度会議録</a>
            <span>最終更新日：2025年3月1日</span>
          </li>
          <li>
            <a href="/gikai/page7510.html">令和4年度第5回定例会（9月会議）会議録</a>
            <span>最終更新日：2022年10月1日</span>
          </li>
          <li>
            <a href="/gikai/page7200.html">令和4年度第4回定例会（6月会議）会議録</a>
          </li>
        </ul>
      </div>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result).toContain("/gikai/page8722.html");
    expect(result).toContain("/gikai/page7510.html");
    expect(result).toContain("/gikai/page7200.html");
  });

  it("重複するリンクを除去する", () => {
    const html = `
      <div>
        <a href="/gikai/page8722.html">令和6年度会議録</a>
        <a href="/gikai/page8722.html">令和6年度会議録（再掲）</a>
        <a href="/gikai/page7510.html">令和4年度第5回定例会会議録</a>
      </div>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(2);
  });

  it("gikai/page パターン以外のリンクはスキップする", () => {
    const html = `
      <div>
        <a href="/gikai/index.html">トップページ</a>
        <a href="/gikai/page8722.html">令和6年度会議録</a>
        <a href="https://example.com/page1234.html">外部リンク</a>
      </div>
    `;

    const result = parseListPage(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("/gikai/page8722.html");
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません。</p></body></html>`;
    expect(parseListPage(html)).toEqual([]);
  });
});

describe("hasNextPage", () => {
  it("次ページパラメータがある場合は true を返す", () => {
    const html = `<a href="List.aspx?c_id=3&class_set_id=6&class_id=6006&pg=2">もっと見る</a>`;
    expect(hasNextPage(html, 1)).toBe(true);
  });

  it("次ページパラメータがない場合は false を返す", () => {
    const html = `<p>以上が全件です。</p>`;
    expect(hasNextPage(html, 1)).toBe(false);
  });

  it("現在ページ以降のパラメータがある場合は true を返す", () => {
    const html = `<a href="List.aspx?pg=3">次へ</a>`;
    expect(hasNextPage(html, 2)).toBe(true);
  });
});

describe("parseDetailPage", () => {
  it("UploadFileOutput.ashx リンクから PDF セッション情報を抽出する", () => {
    const html = `
      <div id="mainBlock">
        <h2>令和6年度 第1回御船町議会定例会（6月会議）</h2>
        <ul>
          <li>
            <a href="/common/UploadFileOutput.ashx?c_id=3&id=8722&sub_id=1&flid=101">
              令和6年度 第1回御船町議会定例会（6月会議）
            </a>
            <span>2.2メガバイト</span>
          </li>
        </ul>
      </div>
    `;

    const result = parseDetailPage(html, "https://www.town.mifune.kumamoto.jp/gikai/page8722.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("令和6年度 第1回御船町議会定例会（6月会議）");
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.mifune.kumamoto.jp/common/UploadFileOutput.ashx?c_id=3&id=8722&sub_id=1&flid=101"
    );
    expect(result[0]!.heldOn).toBe("2024-06-01");
    expect(result[0]!.meetingType).toBe("plenary");
  });

  it("年度まとめ型（複数 PDF）を正しく抽出する", () => {
    const html = `
      <div id="mainBlock">
        <ul>
          <li>
            <a href="/common/UploadFileOutput.ashx?c_id=3&id=8722&sub_id=1&flid=201">
              令和5年度 第7回御船町議会定例会（12月会議）
            </a>
          </li>
          <li>
            <a href="/common/UploadFileOutput.ashx?c_id=3&id=8722&sub_id=1&flid=202">
              令和5年度 第5回御船町議会定例会（9月会議）第1分冊
            </a>
          </li>
          <li>
            <a href="/common/UploadFileOutput.ashx?c_id=3&id=8722&sub_id=1&flid=203">
              令和5年度 第5回御船町議会定例会（9月会議）第2分冊
            </a>
          </li>
        </ul>
      </div>
    `;

    const result = parseDetailPage(html, "https://www.town.mifune.kumamoto.jp/gikai/page8500.html");

    expect(result).toHaveLength(3);
    expect(result[0]!.heldOn).toBe("2023-12-01");
    expect(result[1]!.heldOn).toBe("2023-09-01");
    expect(result[2]!.heldOn).toBe("2023-09-01");
  });

  it("3月会議は年度の翌年として開催日を設定する", () => {
    const html = `
      <div id="mainBlock">
        <ul>
          <li>
            <a href="/common/UploadFileOutput.ashx?c_id=3&id=7000&sub_id=1&flid=300">
              令和5年度 第1回御船町議会定例会（3月会議）
            </a>
          </li>
        </ul>
      </div>
    `;

    const result = parseDetailPage(html, "https://www.town.mifune.kumamoto.jp/gikai/page7000.html");

    expect(result).toHaveLength(1);
    // 令和5年度（2023年度）の3月会議 → 2024年3月
    expect(result[0]!.heldOn).toBe("2024-03-01");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <div id="mainBlock">
        <p>現在準備中です。</p>
      </div>
    `;

    const result = parseDetailPage(html, "https://www.town.mifune.kumamoto.jp/gikai/page9999.html");
    expect(result).toEqual([]);
  });

  it("絶対 URL の PDF リンクをそのまま使用する", () => {
    const html = `
      <div id="mainBlock">
        <a href="https://www.town.mifune.kumamoto.jp/common/UploadFileOutput.ashx?c_id=3&id=100&sub_id=1&flid=1">
          令和4年度第5回定例会（9月会議）会議録
        </a>
      </div>
    `;

    const result = parseDetailPage(html, "https://www.town.mifune.kumamoto.jp/gikai/page7510.html");

    expect(result).toHaveLength(1);
    expect(result[0]!.pdfUrl).toBe(
      "https://www.town.mifune.kumamoto.jp/common/UploadFileOutput.ashx?c_id=3&id=100&sub_id=1&flid=1"
    );
  });
});
