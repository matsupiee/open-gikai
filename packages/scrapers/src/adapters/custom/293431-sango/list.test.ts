import { describe, expect, it } from "vitest";
import {
  parseDateHint,
  parseSectionFromLinkText,
  parseYearIndexPage,
  parseYearPage,
} from "./list";

describe("parseYearIndexPage", () => {
  it("年度別一覧インデックスから会議録ページリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/site/gikai/11721.html">令和7年会議録</a>2026年2月1日更新</li>
        <li><a href="/site/gikai/11718.html">令和6年会議録</a>2025年2月1日更新</li>
        <li><a href="/site/gikai/8392.html">令和5年会議録</a>2024年2月1日更新</li>
        <li><a href="/site/gikai/1929.html">平成31（令和元）年会議録</a>2020年1月1日更新</li>
      </ul>
    `;

    const pages = parseYearIndexPage(html);

    expect(pages).toHaveLength(4);
    expect(pages[0]!.label).toBe("令和7年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.sango.nara.jp/site/gikai/11721.html"
    );
    expect(pages[1]!.label).toBe("令和6年会議録");
    expect(pages[1]!.url).toBe(
      "https://www.town.sango.nara.jp/site/gikai/11718.html"
    );
    expect(pages[3]!.label).toBe("平成31（令和元）年会議録");
  });

  it("会議録ラベルでない gikai リンクはスキップする", () => {
    const html = `
      <a href="/site/gikai/11718.html">令和6年会議録</a>
      <a href="/site/gikai/2275.html">正副議長・各委員会名簿</a>
      <a href="/site/gikai/2276.html">議員名簿</a>
    `;

    const pages = parseYearIndexPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和6年会議録");
  });
});

describe("parseSectionFromLinkText", () => {
  it("定例会のセクション名を抽出する", () => {
    expect(
      parseSectionFromLinkText(
        "令和6年第1回（3月）三郷町議会定例会会議録（初日）"
      )
    ).toBe("第1回（3月）定例会");
  });

  it("臨時会のセクション名を抽出する", () => {
    expect(
      parseSectionFromLinkText(
        "令和6年第1回（5月）三郷町議会臨時会会議録"
      )
    ).toBe("第1回（5月）臨時会");
  });

  it("第4回定例会のセクション名を抽出する", () => {
    expect(
      parseSectionFromLinkText(
        "令和6年第4回（12月）三郷町議会定例会会議録（最終日）"
      )
    ).toBe("第4回（12月）定例会");
  });
});

describe("parseDateHint", () => {
  it("令和6年第1回（3月）から年月を取得する", () => {
    const result = parseDateHint(
      "令和6年第1回（3月）三郷町議会定例会会議録（初日）",
      2024
    );
    expect(result).toEqual({ year: 2024, month: 3 });
  });

  it("令和元年（5月）から年月を取得する", () => {
    const result = parseDateHint(
      "令和元年第1回（5月）三郷町議会臨時会会議録",
      2019
    );
    expect(result).toEqual({ year: 2019, month: 5 });
  });

  it("平成31年（3月）から年月を取得する", () => {
    const result = parseDateHint(
      "平成31年第1回（3月）三郷町議会定例会会議録（初日）",
      2019
    );
    expect(result).toEqual({ year: 2019, month: 3 });
  });

  it("月情報がない場合は null を返す", () => {
    const result = parseDateHint("会議録", 2024);
    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("令和6年ページから全 PDF リンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/9737.pdf">令和6年第1回（3月）三郷町議会定例会会議録（初日）[PDFファイル／1.5MB]</a></li>
        <li><a href="/uploaded/attachment/9738.pdf">令和6年第1回（3月）三郷町議会定例会会議録（最終日）[PDFファイル／615KB]</a></li>
        <li><a href="/uploaded/attachment/9739.pdf">令和6年第1回（5月）三郷町議会臨時会会議録[PDFファイル／429KB]</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.sango.nara.jp/uploaded/attachment/9737.pdf"
    );
    expect(meetings[0]!.section).toBe("第1回（3月）定例会");
    expect(meetings[0]!.title).toBe("第1回（3月）定例会（初日）");
    expect(meetings[0]!.heldOn).toBe("2024-03-01");

    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.town.sango.nara.jp/uploaded/attachment/9738.pdf"
    );
    expect(meetings[1]!.title).toBe("第1回（3月）定例会（最終日）");
    expect(meetings[1]!.heldOn).toBe("2024-03-01");

    expect(meetings[2]!.section).toBe("第1回（5月）臨時会");
    expect(meetings[2]!.title).toBe("第1回（5月）臨時会");
    expect(meetings[2]!.heldOn).toBe("2024-05-01");
  });

  it("令和元年の PDF リンクを正しく処理する", () => {
    const html = `
      <ul>
        <li><a href="/uploaded/attachment/1001.pdf">令和元年第2回（6月）三郷町議会定例会会議録（初日）[PDFファイル／1.2MB]</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2019);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2019-06-01");
    expect(meetings[0]!.section).toBe("第2回（6月）定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<p>会議録はありません。</p>`;
    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(0);
  });
});
