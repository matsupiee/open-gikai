import { describe, it, expect } from "vitest";
import { parseLinkText, parseListPage } from "./list";

describe("parseLinkText", () => {
  it("令和年の定例会（全角数字）を正しくパースする", () => {
    const result = parseLinkText("令和７年第１回定例会（２月１４日）.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.month).toBe(2);
    expect(result!.day).toBe(14);
  });

  it("令和年の臨時会（全角数字）を正しくパースする", () => {
    const result = parseLinkText("令和６年第１回臨時会（５月２２日）.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.session).toBe(1);
    expect(result!.meetingKind).toBe("臨時会");
    expect(result!.month).toBe(5);
    expect(result!.day).toBe(22);
  });

  it("平成30年（半角数字）を正しくパースする", () => {
    const result = parseLinkText("平成30年第3回定例会（12月7日）.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2018);
    expect(result!.session).toBe(3);
    expect(result!.meetingKind).toBe("定例会");
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(7);
  });

  it("令和元年を正しくパースする", () => {
    const result = parseLinkText("令和元年第2回定例会（６月１０日）.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2019);
    expect(result!.session).toBe(2);
    expect(result!.meetingKind).toBe("定例会");
  });

  it("目次は null を返す", () => {
    const result = parseLinkText("令和7年第1回定例会（2月　目次）.pdf");
    expect(result).toBeNull();
  });

  it("会議情報のないテキストは null を返す", () => {
    const result = parseLinkText("国富町議会会議録一覧.pdf");
    expect(result).toBeNull();
  });

  it("日付のない会議情報は null を返す", () => {
    const result = parseLinkText("令和7年第1回定例会.pdf");
    expect(result).toBeNull();
  });
});

describe("parseListPage", () => {
  it("指定年の PDF リンクを正しく抽出する", () => {
    const html = `
      <html><body>
      <h2>令和6年会議録</h2>
      <h3>令和6年第1回定例会</h3>
      <p><a href="/main/administration/abc123.pdf">令和６年第１回定例会（２月　目次）.pdf</a></p>
      <p><a href="/main/administration/def456.pdf">令和６年第１回定例会（２月２２日）.pdf</a></p>
      <p><a href="/main/administration/ghi789.pdf">令和６年第２回定例会（６月１０日）.pdf</a></p>
      <h2>令和5年会議録</h2>
      <p><a href="/main/administration/jkl012.pdf">令和５年第１回定例会（２月２０日）.pdf</a></p>
      </body></html>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.kunitomi.miyazaki.jp/main/administration/def456.pdf"
    );
    expect(meetings[0]!.title).toBe("令和6年第1回定例会（2月22日）");
    expect(meetings[0]!.heldOn).toBe("2024-02-22");
    expect(meetings[0]!.meetingKind).toBe("定例会");

    expect(meetings[1]!.heldOn).toBe("2024-06-10");
  });

  it("目次 PDF をスキップする", () => {
    const html = `
      <p><a href="/main/administration/toc.pdf">令和６年第１回定例会（２月　目次）.pdf</a></p>
      <p><a href="/main/administration/body.pdf">令和６年第１回定例会（２月２２日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("body.pdf");
  });

  it("他の年のリンクをスキップする", () => {
    const html = `
      <p><a href="/main/administration/r7.pdf">令和７年第１回定例会（２月１４日）.pdf</a></p>
      <p><a href="/main/administration/r6.pdf">令和６年第１回定例会（２月２２日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("r7.pdf");
  });

  it("heldOn の昇順にソートされる", () => {
    const html = `
      <p><a href="/main/administration/dec.pdf">令和６年第４回定例会（１２月６日）.pdf</a></p>
      <p><a href="/main/administration/jun.pdf">令和６年第２回定例会（６月１０日）.pdf</a></p>
      <p><a href="/main/administration/feb.pdf">令和６年第１回定例会（２月２２日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-02-22");
    expect(meetings[1]!.heldOn).toBe("2024-06-10");
    expect(meetings[2]!.heldOn).toBe("2024-12-06");
  });

  it("平成30年のリンクを正しく抽出する（半角数字）", () => {
    const html = `
      <p><a href="/main/administration/h30.pdf">平成30年第3回定例会（12月7日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, 2018);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-07");
    expect(meetings[0]!.title).toBe("平成30年第3回定例会（12月7日）");
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<html><body><p>会議録はありません</p></body></html>`;

    const meetings = parseListPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });

  it("絶対 URL のリンクはそのまま使用する", () => {
    const html = `
      <p><a href="http://www.town.kunitomi.miyazaki.jp/main/administration/abs.pdf">令和６年第１回定例会（２月２２日）.pdf</a></p>
    `;

    const meetings = parseListPage(html, 2024);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.kunitomi.miyazaki.jp/main/administration/abs.pdf"
    );
  });
});
