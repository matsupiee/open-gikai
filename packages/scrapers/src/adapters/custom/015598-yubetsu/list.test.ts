import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("会議録リンクのみを抽出し、会議結果は除外する", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250318_141316.pdf">会議結果　PDF(200KB)</a></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.yubetsu.lg.jp/common/img/content/content_20250319_100000.pdf",
    );
  });

  it("相対パスを絶対 URL に変換する", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250318_141316.pdf">会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.yubetsu.lg.jp/common/img/content/content_20250318_141316.pdf",
    );
  });

  it("リンクテキストに月日がある場合は開催日を取得する（h2 の年度を使う）", () => {
    const html = `
      <h2>令和6年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回定例会（令和6年3月6日）</h3></li>
        <li><a href="../../common/img/content/content_20240815_133505.pdf">3月6日　会議録（1日目）　PDF(1294KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-06");
  });

  it("リンクテキストに月日がない場合は h3 の日付を使う", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-01-10");
  });

  it("定例会は plenary に分類される", () => {
    const html = `
      <h2>令和6年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回定例会（令和6年3月6日）</h3></li>
        <li><a href="../../common/img/content/content_20240815_133505.pdf">会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("plenary");
  });

  it("臨時会は extraordinary に分類される", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingType).toBe("extraordinary");
  });

  it("定例会の複数日分の開催日をそれぞれ正しく抽出する", () => {
    const html = `
      <h2>令和6年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第3回定例会（令和6年9月16日）</h3></li>
        <li><a href="../../common/img/content/content_20240910_100000.pdf">9月16日　会議録（1日目）　PDF(1294KB)</a></li>
        <li><a href="../../common/img/content/content_20240917_100000.pdf">9月18日　会議録（2日目）　PDF(900KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-09-16");
    expect(meetings[1]!.heldOn).toBe("2024-09-18");
  });

  it("複数の年度の会議録を抽出する", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">会議録　PDF(740KB)</a></li>
      </ul>
      <h2>令和6年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回定例会（令和6年3月6日）</h3></li>
        <li><a href="../../common/img/content/content_20240815_133505.pdf">3月6日　会議録（1日目）　PDF(1294KB)</a></li>
        <li><a href="../../common/img/content/content_20240815_133600.pdf">3月7日　会議録（2日目）　PDF(900KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(3);
  });

  it("全角数字の年度表記に対応する", () => {
    const html = `
      <h2>令和７年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和７年１月１０日）</h3></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">１月１０日　会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2025-01-10");
  });

  it("タイトルに年度と会議名が含まれる", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">会議録　PDF(740KB)</a></li>
      </ul>
    `;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toContain("令和7年");
    expect(meetings[0]!.title).toContain("第1回臨時会");
    expect(meetings[0]!.title).toContain("会議録");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <p>会議録は準備中です。</p>
    `;
    expect(parseListPage(html)).toEqual([]);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parseListPage("")).toEqual([]);
  });

  it("会議録を含まないリンクテキストはスキップする", () => {
    const html = `
      <h2>令和7年（会議結果・議事録）</h2>
      <ul>
        <li><h3>第1回臨時会（令和7年1月10日）</h3></li>
        <li><a href="../../common/img/content/content_20250319_100000.pdf">PDFファイル(740KB)</a></li>
      </ul>
    `;
    expect(parseListPage(html)).toEqual([]);
  });
});
