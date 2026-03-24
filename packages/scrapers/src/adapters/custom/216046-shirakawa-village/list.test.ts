import { describe, expect, it } from "vitest";
import { extractNextPfromId, parsePageLinks } from "./list";

describe("parsePageLinks", () => {
  it("/secure/ 配下の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/secure/1234/R7_1_teirei_nittei.pdf">令和7年第1回定例会 議事運営日程</a></li>
        <li><a href="/secure/1235/R7_1_teirei_gian.pdf">令和7年第1回定例会 上程議案一覧</a></li>
        <li><a href="/secure/1236/R7_1_ippan.pdf">令和7年第1回定例会 一般質問通告</a></li>
      </ul>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(3);

    expect(links[0]!.pdfUrl).toBe(
      "https://www.vill.shirakawa.lg.jp/secure/1234/R7_1_teirei_nittei.pdf"
    );
    expect(links[0]!.kind).toBe("nittei");
    expect(links[0]!.year).toBe(2025);
    expect(links[0]!.meetingType).toBe("plenary");

    expect(links[1]!.kind).toBe("gian");
    expect(links[2]!.kind).toBe("ippan");
  });

  it("議会だよりリンクを正しく分類する", () => {
    const html = `
      <a href="/secure/9999/gikai_52.pdf">しらかわ議会だより第52号（令和8年1月）</a>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe("gikai");
    expect(links[0]!.year).toBe(2026);
  });

  it("臨時会リンクを正しく分類する", () => {
    const html = `
      <a href="/secure/5678/R6_rinji_nittei.pdf">令和6年臨時会 議事運営日程</a>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.meetingType).toBe("extraordinary");
    expect(links[0]!.year).toBe(2024);
  });

  it("/secure/ 以外のリンクは無視する", () => {
    const html = `
      <a href="/1098.htm">トップ</a>
      <a href="/files/upload/some.pdf">他のPDF</a>
      <a href="/secure/1234/R7_1_nittei.pdf">令和7年 日程</a>
    `;

    const links = parsePageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.pdfUrl).toContain("/secure/1234/");
  });

  it("サイズ表記をタイトルから除去する", () => {
    const html = `
      <a href="/secure/1234/R7_1_nittei.pdf">令和7年第1回定例会 議事運営日程(350KB)</a>
    `;

    const links = parsePageLinks(html);

    expect(links[0]!.title).not.toContain("(350KB)");
    expect(links[0]!.title).toBe("令和7年第1回定例会 議事運営日程");
  });

  it("日付を含むリンクテキストから heldOn を抽出する", () => {
    const html = `
      <a href="/secure/1234/R7_1_nittei.pdf">令和7年3月4日 第1回定例会 議事運営日程</a>
    `;

    const links = parsePageLinks(html);

    expect(links[0]!.heldOn).toBe("2025-03-04");
  });

  it("日付を含まないリンクテキストでは heldOn が null になる", () => {
    const html = `
      <a href="/secure/1234/R7_1_nittei.pdf">令和7年第1回定例会 議事運営日程</a>
    `;

    const links = parsePageLinks(html);

    expect(links[0]!.heldOn).toBeNull();
  });

  it("令和元年に対応する", () => {
    const html = `
      <a href="/secure/1111/R1_2_teirei_ippan.pdf">令和元年第2回定例会 一般質問通告</a>
    `;

    const links = parsePageLinks(html);

    expect(links[0]!.year).toBe(2019);
  });

  it("平成の年号に対応する", () => {
    const html = `
      <a href="/secure/2222/H30_4_teirei_nittei.pdf">平成30年第4回定例会 議事運営日程</a>
    `;

    const links = parsePageLinks(html);

    expect(links[0]!.year).toBe(2018);
  });

  it("空の HTML は空配列を返す", () => {
    expect(parsePageLinks("")).toEqual([]);
  });
});

describe("extractNextPfromId", () => {
  it("次ページのリンクから pfromid を取得する", () => {
    const html = `
      <a href="/dd.aspx?moduleid=2797&pfromid=8">次の一覧へ</a>
    `;
    expect(extractNextPfromId(html)).toBe(8);
  });

  it("次ページリンクがない場合は null を返す", () => {
    const html = `<p>最後のページです</p>`;
    expect(extractNextPfromId(html)).toBeNull();
  });
});
