import { describe, expect, it } from "vitest";
import { parseMeetingDate, parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("トップページから年度別ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/gyoseijoho/gikai/1/7996.html">令和7年度　定例会・臨時会 会議録</a></li>
        <li><a href="/gyoseijoho/gikai/1/7370.html">令和6年度　定例会・臨時会 会議録</a></li>
        <li><a href="/gyoseijoho/gikai/1/6908.html">令和5年度　定例会・臨時会 会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年度　定例会・臨時会 会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.kanan.osaka.jp/gyoseijoho/gikai/1/7996.html"
    );
    expect(pages[1]!.label).toBe("令和6年度　定例会・臨時会 会議録");
    expect(pages[2]!.label).toBe("令和5年度　定例会・臨時会 会議録");
  });

  it("重複するリンクを除去する", () => {
    const html = `
      <a href="/gyoseijoho/gikai/1/7370.html">令和6年度</a>
      <a href="/gyoseijoho/gikai/1/7370.html">令和6年度（同じ）</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
  });

  it("/gyoseijoho/gikai/1/ パターン以外はスキップする", () => {
    const html = `
      <a href="/material/files/group/22/R0612_teireikaigi.pdf">PDF</a>
      <a href="/gyoseijoho/gikai/1/7370.html">令和6年度</a>
      <a href="/other/page.html">他のページ</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和6年度");
  });
});

describe("parseMeetingDate", () => {
  it("令和の年月をパースする", () => {
    expect(parseMeetingDate("令和6年12月定例会議会議録")).toBe("2024-12-01");
  });

  it("令和7年をパースする", () => {
    expect(parseMeetingDate("令和7年3月定例会議会議録")).toBe("2025-03-01");
  });

  it("令和元年をパースする", () => {
    expect(parseMeetingDate("令和元年9月定例会議会議録")).toBe("2019-09-01");
  });

  it("平成の年月をパースする", () => {
    expect(parseMeetingDate("平成30年12月定例会議会議録")).toBe("2018-12-01");
  });

  it("平成元年をパースする", () => {
    expect(parseMeetingDate("平成元年3月定例会議会議録")).toBe("1989-03-01");
  });

  it("年月のないテキストは null を返す", () => {
    expect(parseMeetingDate("会議録一覧")).toBeNull();
  });

  it("月が1桁でも正しくパースする", () => {
    expect(parseMeetingDate("令和6年3月定例会議会議録")).toBe("2024-03-01");
  });
});

describe("parseYearPage", () => {
  it("年度別ページから PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議会議録</a></li>
        <li><a href="/material/files/group/22/R0609_teireikaigi.pdf">令和6年9月定例会議会議録</a></li>
        <li><a href="/material/files/group/22/R0701_rinjikaigi.pdf">令和7年1月臨時会議会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.title).toBe("令和6年12月定例会議会議録");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kanan.osaka.jp/material/files/group/22/R0612_teireikaigi.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
    expect(meetings[0]!.section).toBe("令和6年12月定例会議会議録");

    expect(meetings[1]!.heldOn).toBe("2024-09-01");

    expect(meetings[2]!.title).toBe("令和7年1月臨時会議会議録");
    expect(meetings[2]!.heldOn).toBe("2025-01-01");
  });

  it("group/1 パターン（旧グループ ID）も抽出できる", () => {
    const html = `
      <a href="/material/files/group/1/R03_06teireikaigi.pdf">令和3年6月定例会議会議録</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kanan.osaka.jp/material/files/group/1/R03_06teireikaigi.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2021-06-01");
  });

  it("プロトコル相対 URL (//www.town...) を正しく処理する", () => {
    const html = `
      <a href="//www.town.kanan.osaka.jp/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議会議録</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.kanan.osaka.jp/material/files/group/22/R0612_teireikaigi.pdf"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
  });

  it("重複する PDF URL を除去する", () => {
    const html = `
      <a href="/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議</a>
      <a href="/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議（同じ）</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("PDF でないリンクはスキップする", () => {
    const html = `
      <a href="/gyoseijoho/gikai/1/index.html">会議録トップ</a>
      <a href="/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
  });

  it("年月を含まないタイトルでも heldOn は null を返す", () => {
    const html = `
      <a href="/material/files/group/22/kaigiroku.pdf">会議録</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });
});
