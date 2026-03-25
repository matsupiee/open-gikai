import { describe, it, expect } from "vitest";
import {
  parseYearPage,
  parseMeetingDateFromText,
  parseMeetingTitleFromText,
} from "./list";

const PAGE_URL = "https://www.city.muroto.kochi.jp/pages/page3221.php";

describe("parseYearPage", () => {
  it("第N号を含む PDF リンクを抽出する", () => {
    const html = `
      <a href="../pbfile/m003221/pbf20250606112145_C0AMALt2V4VD.pdf">第１回定例会　第１号</a>
      <a href="../pbfile/m003221/pbf20250607080000_AbCdEfGhIjKl.pdf">第１回定例会　第２号</a>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.muroto.kochi.jp/pbfile/m003221/pbf20250606112145_C0AMALt2V4VD.pdf"
    );
    expect(meetings[0]!.section).toBe("第１回 定例会");
    expect(meetings[0]!.title).toBe("第１回定例会 第１号");
    expect(meetings[1]!.section).toBe("第１回 定例会");
  });

  it("臨時会の PDF リンクを抽出する", () => {
    const html = `
      <a href="../pbfile/m003221/pbf20250201100000.pdf">第１回臨時会　第１号</a>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("第１回 臨時会");
  });

  it("目次・日程・通告・資料・議決リンクを除外する", () => {
    const html = `
      <a href="../pbfile/m003221/pbf001.pdf">第１回定例会　目次</a>
      <a href="../pbfile/m003221/pbf002.pdf">第１回定例会　会期日程</a>
      <a href="../pbfile/m003221/pbf003.pdf">第１回定例会　一般質問順序・通告内容</a>
      <a href="../pbfile/m003221/pbf004.pdf">第１回定例会　資料</a>
      <a href="../pbfile/m003221/pbf005.pdf">第１回定例会　議決結果一覧表</a>
      <a href="../pbfile/m003221/pbf006.pdf">第１回定例会　第１号</a>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第１回定例会 第１号");
  });

  it("絶対パスの PDF URL を正しく構築する", () => {
    const html = `
      <a href="/pbfile/m003221/pbf20250606112145.pdf">第１回定例会　第１号</a>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.muroto.kochi.jp/pbfile/m003221/pbf20250606112145.pdf"
    );
  });

  it("旧形式（タイムスタンプのみ）の PDF ファイル名にも対応する", () => {
    const html = `
      <a href="../pbfile/m000952/pbf20091215134512.pdf">第４回定例会　第１号</a>
    `;

    const meetings = parseYearPage(html, "https://www.city.muroto.kochi.jp/pages/page0952.php");

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.muroto.kochi.jp/pbfile/m000952/pbf20091215134512.pdf"
    );
  });

  it("複数の定例会が正しく区別される", () => {
    const html = `
      <a href="../pbfile/m002899/pbf001.pdf">第１回定例会　第１号</a>
      <a href="../pbfile/m002899/pbf002.pdf">第２回定例会　第１号</a>
      <a href="../pbfile/m002899/pbf003.pdf">第３回定例会　第１号</a>
    `;

    const meetings = parseYearPage(html, "https://www.city.muroto.kochi.jp/pages/page2899.php");

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.section).toBe("第１回 定例会");
    expect(meetings[1]!.section).toBe("第２回 定例会");
    expect(meetings[2]!.section).toBe("第３回 定例会");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<div><p>会議録はありません。</p></div>`;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(0);
  });
});

describe("parseMeetingDateFromText", () => {
  it("令和年月日を YYYY-MM-DD にパースする", () => {
    const text = `令和７年２月　室戸市議会第１回臨時会会議録（第１号）
令和７年２月２５日（火曜日）　午前１０時００分開議`;

    expect(parseMeetingDateFromText(text)).toBe("2025-02-25");
  });

  it("平成年月日を YYYY-MM-DD にパースする", () => {
    const text = `平成30年３月　室戸市議会第１回定例会会議録（第１号）
平成30年３月５日（月曜日）　午前１０時開議`;

    expect(parseMeetingDateFromText(text)).toBe("2018-03-05");
  });

  it("令和元年をパースする", () => {
    const text = `令和元年６月　室戸市議会第２回定例会会議録（第１号）
令和元年６月１０日（月曜日）`;

    expect(parseMeetingDateFromText(text)).toBe("2019-06-10");
  });

  it("日付が見つからない場合は null を返す", () => {
    expect(parseMeetingDateFromText("会議録テキスト")).toBeNull();
  });
});

describe("parseMeetingTitleFromText", () => {
  it("定例会のタイトルを抽出する", () => {
    const text = `令和７年３月　室戸市議会第１回定例会会議録（第１号）`;

    expect(parseMeetingTitleFromText(text)).toBe("第１回 定例会 第１号");
  });

  it("臨時会のタイトルを抽出する", () => {
    const text = `令和７年２月　室戸市議会第１回臨時会会議録（第１号）`;

    expect(parseMeetingTitleFromText(text)).toBe("第１回 臨時会 第１号");
  });

  it("タイトルが見つからない場合は null を返す", () => {
    expect(parseMeetingTitleFromText("会議録テキスト")).toBeNull();
  });
});
