import { describe, expect, it } from "vitest";
import { parseHeadingYear, parseListPage, parseMeetingLink, resolvePdfUrl } from "./list";

describe("parseHeadingYear", () => {
  it("令和の年度見出しを西暦に変換する", () => {
    expect(parseHeadingYear("◇ 令和７年開催 ◇")).toEqual({
      year: 2025,
      eraLabel: "令和7年",
    });
  });

  it("見出しでない場合は null を返す", () => {
    expect(parseHeadingYear("・定例会")).toBeNull();
  });
});

describe("parseMeetingLink", () => {
  it("リンクテキストからタイトルと開催情報を抽出する", () => {
    expect(
      parseMeetingLink("→第１回町議会定例会議決結果（３月３日、18日）", {
        year: 2025,
        eraLabel: "令和7年",
      }),
    ).toEqual({
      title: "令和7年第1回町議会定例会議決結果",
      meetingType: "plenary",
      year: 2025,
      dateText: "3月3日,18日".replace(",", "、"),
    });
  });

  it("臨時会を extraordinary として判定する", () => {
    expect(
      parseMeetingLink("→第２回町議会臨時会議決結果（４月14日）", {
        year: 2025,
        eraLabel: "令和7年",
      }),
    )?.toMatchObject({
      meetingType: "extraordinary",
      title: "令和7年第2回町議会臨時会議決結果",
    });
  });
});

describe("resolvePdfUrl", () => {
  it("絶対 URL をそのまま返す", () => {
    expect(resolvePdfUrl("https://example.com/test.pdf")).toBe("https://example.com/test.pdf");
  });

  it("相対 URL を完全 URL に変換する", () => {
    expect(resolvePdfUrl("/wp-content/uploads/test.pdf")).toBe(
      "https://www.town.kembuchi.hokkaido.jp/wp-content/uploads/test.pdf",
    );
  });
});

describe("parseListPage", () => {
  it("年度別の PDF 一覧を抽出する", () => {
    const html = `
      <p><strong><span>◇ 令和７年開催 ◇</span></strong></p>
      <p><strong>・定例会</strong></p>
      <p><a href="https://www.town.kembuchi.hokkaido.jp/wp-content/uploads/a.pdf">→第１回町議会定例会議決結果（３月３日、18日）</a></p>
      <p><strong>・臨時会</strong></p>
      <p><a href="/wp-content/uploads/b.pdf">→第２回町議会臨時会議決結果（４月14日）</a></p>
      <p><strong><span>◇ 令和６年開催 ◇</span></strong></p>
      <p><strong>・定例会</strong></p>
      <p><a href="/wp-content/uploads/c.pdf">→第１回町議会定例会議決結果（２月29日、３月15日）</a></p>
    `;

    const result = parseListPage(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      title: "令和7年第1回町議会定例会議決結果",
      meetingType: "plenary",
      year: 2025,
      dateText: "3月3日、18日",
    });
    expect(result[1]).toMatchObject({
      title: "令和7年第2回町議会臨時会議決結果",
      meetingType: "extraordinary",
      year: 2025,
      pdfUrl: "https://www.town.kembuchi.hokkaido.jp/wp-content/uploads/b.pdf",
    });
    expect(result[2]?.year).toBe(2024);
  });

  it("年度見出しの前にあるリンクはスキップする", () => {
    const html = `<p><a href="/wp-content/uploads/a.pdf">→第１回町議会定例会議決結果（３月３日）</a></p>`;
    expect(parseListPage(html)).toEqual([]);
  });

  it("同じ PDF は重複登録しない", () => {
    const html = `
      <p><strong><span>◇ 令和７年開催 ◇</span></strong></p>
      <p><a href="/wp-content/uploads/a.pdf">→第１回町議会定例会議決結果（３月３日）</a></p>
      <p><a href="/wp-content/uploads/a.pdf">→第１回町議会定例会議決結果（３月３日）</a></p>
    `;

    expect(parseListPage(html)).toHaveLength(1);
  });
});
