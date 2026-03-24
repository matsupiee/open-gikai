import { describe, it, expect } from "vitest";
import { parseLinkText, parseListPage, removeSizeAnnotation, buildHeldOn } from "./list";

describe("removeSizeAnnotation", () => {
  it("（PDF:1159KB）を除去する", () => {
    expect(removeSizeAnnotation("平成28年9月定例議会会議録（PDF:1159KB）")).toBe(
      "平成28年9月定例議会会議録"
    );
  });

  it("（PDF:3.07MB）を除去する", () => {
    expect(
      removeSizeAnnotation(
        "令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会（PDF:3.07MB）"
      )
    ).toBe("令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会");
  });

  it("サイズ表記がなければそのまま返す", () => {
    expect(removeSizeAnnotation("令和3年第3回議会第3回定例会")).toBe(
      "令和3年第3回議会第3回定例会"
    );
  });
});

describe("parseLinkText", () => {
  it("平成年+月+定例議会パターンをパースする", () => {
    const result = parseLinkText("平成28年9月定例議会会議録（PDF:1159KB）");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2016);
    expect(result!.month).toBe(9);
    expect(result!.meetingKind).toBe("定例議会");
  });

  it("平成年+月+臨時議会パターンをパースする", () => {
    const result = parseLinkText("平成28年10月臨時議会会議録（PDF:500KB）");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2016);
    expect(result!.month).toBe(10);
    expect(result!.meetingKind).toBe("臨時議会");
  });

  it("令和年+第N回定例会パターンをパースする", () => {
    const result = parseLinkText("令和3年第3回議会第3回定例会（PDF:2MB）");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2021);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("令和元年をパースする", () => {
    const result = parseLinkText("令和元年9月定例議会会議録（PDF:1000KB）");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.month).toBe(9);
  });

  it("定例と臨時が混在する場合は定例を優先する", () => {
    const result = parseLinkText(
      "令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会（PDF:3.07MB）"
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("和暦を含まないテキストは null を返す", () => {
    const result = parseLinkText("会議録一覧");
    expect(result).toBeNull();
  });
});

describe("buildHeldOn", () => {
  it("年と月が揃っている場合は YYYY-MM-01 を返す", () => {
    expect(buildHeldOn(2016, 9)).toBe("2016-09-01");
  });

  it("月が null の場合は null を返す", () => {
    expect(buildHeldOn(2021, null)).toBeNull();
  });

  it("12月は 2桁ゼロ埋めしない", () => {
    expect(buildHeldOn(2018, 12)).toBe("2018-12-01");
  });
});

describe("parseListPage", () => {
  it("指定年の PDF リンクを正しく抽出する", () => {
    const html = `
      <html><body>
      <p class="link01"><a href="/files/201609gikaikaigiroku.pdf">平成28年9月定例議会会議録（PDF:1159KB）</a></p>
      <p class="link01"><a href="/files/201612gikaikaigiroku.pdf">平成28年12月定例議会会議録（PDF:1200KB）</a></p>
      <p class="link01"><a href="/files/201703gikairoku.pdf">平成29年3月定例議会会議録（PDF:1400KB）</a></p>
      </body></html>
    `;

    const meetings = parseListPage(html, 2016);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.yakage.okayama.jp/files/201609gikaikaigiroku.pdf"
    );
    expect(meetings[0]!.title).toBe("平成28年9月定例議会会議録");
    expect(meetings[0]!.heldOn).toBe("2016-09-01");
    expect(meetings[0]!.meetingKind).toBe("定例議会");

    expect(meetings[1]!.heldOn).toBe("2016-12-01");
  });

  it("他の年のリンクをスキップする", () => {
    const html = `
      <p class="link01"><a href="/files/202112gijiroku.pdf">令和3年第4回議会第4回定例会（PDF:2MB）</a></p>
      <p class="link01"><a href="/files/201609gikaikaigiroku.pdf">平成28年9月定例議会会議録（PDF:1159KB）</a></p>
    `;

    const meetings = parseListPage(html, 2021);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("202112");
  });

  it("定例と臨時が混在する PDF を正しく分類する", () => {
    const html = `
      <p class="link01"><a href="/files/202312teireirinji.pdf">令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会（PDF:3.07MB）</a></p>
    `;

    const meetings = parseListPage(html, 2023);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.meetingKind).toBe("定例会");
  });

  it("heldOn が null の場合もリストに含まれる", () => {
    const html = `
      <p class="link01"><a href="/files/202112gijiroku.pdf">令和3年第4回議会第4回定例会（PDF:2MB）</a></p>
    `;

    const meetings = parseListPage(html, 2021);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("二重拡張子（.pdf.pdf）のリンクも抽出する", () => {
    const html = `
      <p class="link01"><a href="/files/202007gikai_gijiroku456.pdf.pdf">令和2年9月定例議会会議録（PDF:800KB）</a></p>
    `;

    const meetings = parseListPage(html, 2020);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain(".pdf.pdf");
  });

  it("絶対 URL のリンクはそのまま使用する", () => {
    const html = `
      <p class="link01"><a href="http://www.town.yakage.okayama.jp/files/201609abs.pdf">平成28年9月定例議会会議録（PDF:1000KB）</a></p>
    `;

    const meetings = parseListPage(html, 2016);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.yakage.okayama.jp/files/201609abs.pdf"
    );
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("heldOn がある会議は昇順にソートされる", () => {
    const html = `
      <p class="link01"><a href="/files/201612gikaikaigiroku.pdf">平成28年12月定例議会会議録（PDF:1200KB）</a></p>
      <p class="link01"><a href="/files/201609gikaikaigiroku.pdf">平成28年9月定例議会会議録（PDF:1159KB）</a></p>
    `;

    const meetings = parseListPage(html, 2016);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2016-09-01");
    expect(meetings[1]!.heldOn).toBe("2016-12-01");
  });

  it("parts/files/ パスの PDF リンクも抽出する", () => {
    const html = `
      <p class="link01"><a href="/parts/files/201706gikaikaigiroku.pdf">平成29年6月定例議会会議録（PDF:900KB）</a></p>
    `;

    const meetings = parseListPage(html, 2017);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.yakage.okayama.jp/parts/files/201706gikaikaigiroku.pdf"
    );
  });
});
