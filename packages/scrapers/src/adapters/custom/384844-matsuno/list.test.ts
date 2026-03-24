import { describe, expect, it } from "vitest";
import { parseIndexUrls, parseYearPage } from "./list";

describe("parseIndexUrls", () => {
  it("年度別ページの URL を抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/16630.html">令和８年</a></li>
        <li><a href="/site/gikai/14776.html">令和７年</a></li>
        <li><a href="/site/gikai/13204.html">令和６年</a></li>
      </ul>
    `;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(
      "https://www.town.matsuno.ehime.jp/site/gikai/16630.html",
    );
    expect(urls[1]).toBe(
      "https://www.town.matsuno.ehime.jp/site/gikai/14776.html",
    );
    expect(urls[2]).toBe(
      "https://www.town.matsuno.ehime.jp/site/gikai/13204.html",
    );
  });

  it("数値 ID のみのリンクを抽出する（list156 などは除外される）", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/16630.html">令和８年</a></li>
        <li><a href="/site/gikai/list156.html">一覧へ戻る</a></li>
      </ul>
    `;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://www.town.matsuno.ehime.jp/site/gikai/16630.html",
    );
  });

  it("重複 URL は除外する", () => {
    const html = `
      <a href="/site/gikai/16630.html">令和８年</a>
      <a href="/site/gikai/16630.html">令和８年（再掲）</a>
    `;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>リンクなし</p></body></html>`;

    const urls = parseIndexUrls(html);

    expect(urls).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  it("定例会の PDF リンクを抽出する（実際のHTML構造）", () => {
    const html = `
      <h1>令和６年　会議録一覧</h1>
      <div class="detail_free"><h2><span style="font-size:130%">定例会</span></h2></div>
      <div class="detail_free">
        <p><strong>12月定例会（12月13日）​</strong></p>
        <p><a href="/uploaded/attachment/6205.pdf">本会議（１日目） [PDFファイル／471KB]</a></p>
      </div>
      <div class="detail_free">
        <p><strong>9月定例会（9月3日～12日）</strong></p>
        <p><a href="/uploaded/attachment/6062.pdf">本会議（１日目） [PDFファイル／497KB]</a></p>
        <p><a href="/uploaded/attachment/6063.pdf">本会議（10日目） [PDFファイル／261KB]</a></p>
      </div>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(3);
    expect(sessions[0]!.pdfUrl).toBe(
      "https://www.town.matsuno.ehime.jp/uploaded/attachment/6205.pdf",
    );
    expect(sessions[0]!.heldOn).toBe("2024-12-13");
    expect(sessions[0]!.meetingType).toBe("plenary");
    // タイトルには strong テキストとリンクテキストが連結される
    expect(sessions[0]!.title).toContain("本会議（１日目）");
    expect(sessions[0]!.title).toContain("12月定例会");
    // 複数日範囲の最初の日を取得する
    expect(sessions[1]!.heldOn).toBe("2024-09-03");
    expect(sessions[2]!.heldOn).toBe("2024-09-03");
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <h1>令和６年　会議録一覧</h1>
      <div class="detail_free"><h2><span>臨時会</span></h2></div>
      <div class="detail_free">
        <p><strong>8月臨時会（8月1日）</strong></p>
        <p><a href="/uploaded/attachment/6000.pdf">本会議（１日目） [PDFファイル／137KB]</a></p>
      </div>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBe("2024-08-01");
    expect(sessions[0]!.meetingType).toBe("extraordinary");
  });

  it("定例会と臨時会が混在する場合を正しく分類する", () => {
    const html = `
      <h1>令和６年　会議録一覧</h1>
      <div class="detail_free"><h2><span>定例会</span></h2></div>
      <div class="detail_free">
        <p><strong>3月定例会（3月5日）</strong></p>
        <p><a href="/uploaded/attachment/5613.pdf">本会議（１日目） [PDFファイル／492KB]</a></p>
      </div>
      <div class="detail_free"><h2><span>臨時会</span></h2></div>
      <div class="detail_free">
        <p><strong>8月臨時会（8月1日）</strong></p>
        <p><a href="/uploaded/attachment/6000.pdf">本会議（１日目） [PDFファイル／137KB]</a></p>
      </div>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.meetingType).toBe("plenary");
    expect(sessions[0]!.heldOn).toBe("2024-03-05");
    expect(sessions[1]!.meetingType).toBe("extraordinary");
    expect(sessions[1]!.heldOn).toBe("2024-08-01");
  });

  it("令和元年を正しく処理する", () => {
    const html = `
      <h1>令和元年　会議録一覧</h1>
      <div class="detail_free"><h2><span>定例会</span></h2></div>
      <div class="detail_free">
        <p><strong>12月定例会（12月3日）</strong></p>
        <p><a href="/uploaded/attachment/5000.pdf">本会議 [PDFファイル／300KB]</a></p>
      </div>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBe("2019-12-03");
  });

  it("全角数字の年号を正しく処理する（令和６年）", () => {
    const html = `
      <h1>令和６年　会議録一覧</h1>
      <div class="detail_free"><h2><span>定例会</span></h2></div>
      <div class="detail_free">
        <p><strong>6月定例会（6月14日）</strong></p>
        <p><a href="/uploaded/attachment/5838.pdf">本会議（1日目） [PDFファイル／507KB]</a></p>
      </div>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.heldOn).toBe("2024-06-14");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h1>令和６年　会議録一覧</h1>
      <div class="detail_free"><h2><span>定例会</span></h2></div>
      <div class="detail_free">
        <p>まだ公開されていません。</p>
      </div>
    `;

    const sessions = parseYearPage(html);

    expect(sessions).toHaveLength(0);
  });
});
