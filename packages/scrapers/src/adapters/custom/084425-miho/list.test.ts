import { describe, expect, it } from "vitest";
import { parseYearPageLinks, parsePdfLinks } from "./list";

describe("parseYearPageLinks", () => {
  it("絶対 URL 形式の年度別ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html">2024年（令和6年）　村議会会議録</a></li>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page012797.html">2023年（令和5年）　村議会会議録</a></li>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page011488.html">2022年（令和4年）　村議会会議録</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]!.title).toBe("2024年（令和6年） 村議会会議録");
    expect(links[0]!.url).toBe("https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html");
    expect(links[1]!.title).toBe("2023年（令和5年） 村議会会議録");
    expect(links[2]!.title).toBe("2022年（令和4年） 村議会会議録");
  });

  it("相対 URL 形式の年度別ページへのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="page013511.html">2024年（令和6年）　村議会会議録</a></li>
        <li><a href="page012797.html">2023年（令和5年）　村議会会議録</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.url).toBe("https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html");
    expect(links[1]!.url).toBe("https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page012797.html");
  });

  it("平成年のリンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page006053.html">2018年（平成30年）　村議会会議録</a></li>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page008655.html">2019年（令和元年）　村議会会議録</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0]!.title).toBe("2018年（平成30年） 村議会会議録");
    expect(links[1]!.title).toBe("2019年（令和元年） 村議会会議録");
  });

  it("年度名を含まないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html">令和6年　村議会会議録</a></li>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page999.html">議会概要について</a></li>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page888.html">委員会名簿</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.url).toContain("page013511.html");
  });

  it("重複 URL を除外する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html">令和6年　会議録</a></li>
        <li><a href="https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html">令和6年　会議録</a></li>
      </ul>
    `;

    const links = parseYearPageLinks(html);
    expect(links).toHaveLength(1);
  });

  it("リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中</p></div>`;
    const links = parseYearPageLinks(html);
    expect(links).toHaveLength(0);
  });
});

describe("parsePdfLinks", () => {
  it("定例会・臨時会の PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/1752043948_doc_165_0.pdf">令和6年第4回定例会 [PDF形式／717.5KB]</a></li>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/1752043948_doc_165_1.pdf">令和6年第2回臨時会 [PDF形式／246.12KB]</a></li>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/1752043948_doc_165_2.pdf">令和6年第3回定例会 [PDF形式／959.75KB]</a></li>
      </ul>
    `;

    const records = parsePdfLinks(html);

    expect(records).toHaveLength(3);
    expect(records[0]!.title).toBe("令和6年第4回定例会");
    expect(records[0]!.pdfUrl).toBe("https://www.vill.miho.lg.jp/data/doc/1752043948_doc_165_0.pdf");
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[1]!.title).toBe("令和6年第2回臨時会");
    expect(records[1]!.meetingType).toBe("extraordinary");
    expect(records[2]!.title).toBe("令和6年第3回定例会");
  });

  it("臨時会の meetingType は extraordinary になる", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/1000000000_doc_165_0.pdf">令和6年第1回臨時会 [PDF形式／270.02KB]</a></li>
      </ul>
    `;

    const records = parsePdfLinks(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("令和/平成を含まないリンクはスキップする", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/1752043948_doc_165_0.pdf">令和6年第4回定例会 [PDF形式／717.5KB]</a></li>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/other.pdf">議会だより</a></li>
      </ul>
    `;

    const records = parsePdfLinks(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.title).toBe("令和6年第4回定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>準備中</p></div>`;
    const records = parsePdfLinks(html);
    expect(records).toHaveLength(0);
  });

  it("平成年の PDF リンクも抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.vill.miho.lg.jp/data/doc/1000000000_doc_165_0.pdf">平成30年第4回定例会 [PDF形式／700KB]</a></li>
      </ul>
    `;

    const records = parsePdfLinks(html);

    expect(records).toHaveLength(1);
    expect(records[0]!.title).toBe("平成30年第4回定例会");
    expect(records[0]!.meetingType).toBe("plenary");
  });
});
