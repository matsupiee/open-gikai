import { describe, it, expect } from "vitest";
import { parseYearPage } from "./list";
import { parseDateFromH2 } from "./shared";

describe("parseDateFromH2", () => {
  it("令和N年M月パターン（定例会・半角）をパースする", () => {
    expect(
      parseDateFromH2("令和6年第3回定例会（令和6年9月）"),
    ).toBe("2024-09-01");
  });

  it("令和N年M月パターン（定例会・全角）をパースする", () => {
    expect(
      parseDateFromH2("令和６年第３回定例会（令和６年９月）"),
    ).toBe("2024-09-01");
  });

  it("令和N年M月D日パターン（臨時会・半角）をパースする", () => {
    expect(
      parseDateFromH2("令和6年第2回臨時会（令和6年8月19日）"),
    ).toBe("2024-08-19");
  });

  it("令和N年M月D日パターン（臨時会・全角）をパースする", () => {
    expect(
      parseDateFromH2("令和６年第５回臨時会（令和６年１０月２１日）"),
    ).toBe("2024-10-21");
  });

  it("令和元年をパースする", () => {
    expect(
      parseDateFromH2("令和元年第4回定例会（令和元年12月）"),
    ).toBe("2019-12-01");
  });

  it("平成N年をパースする", () => {
    expect(
      parseDateFromH2("平成30年第4回定例会（平成30年12月）"),
    ).toBe("2018-12-01");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromH2("定例会・臨時会")).toBeNull();
  });

  it("令和7年3月（全角）をパースする", () => {
    expect(
      parseDateFromH2("令和７年第１回定例会（令和７年３月）"),
    ).toBe("2025-03-01");
  });
});

describe("parseYearPage", () => {
  const yearPageUrl =
    "http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/R6teireikairinjikai.html";

  it("h2 直後の <p> から「会議録」リンクを抽出する（全角数字）", () => {
    const html = `
      <div class="cont">
        <h1>令和６年　定例会・臨時会</h1>
        <div class="detail">
          <h2>令和６年第３回定例会（令和６年９月）</h2>
          <p><a href="files/20240912-132656.pdf">会期日程.pdf</a></p>
          <p><a href="files/20240912-132718.pdf">議案目録.pdf</a></p>
          <p><a href="files/20240912-kaigiroku.pdf">会議録（一般質問）</a></p>
          <p><a href="files/20240912-kekka.pdf">会議結果.pdf</a></p>
        </div>
      </div>
    `;

    const meetings = parseYearPage(html, yearPageUrl);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和６年第３回定例会（令和６年９月）");
    expect(meetings[0]!.heldOn).toBe("2024-09-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/files/20240912-kaigiroku.pdf",
    );
    expect(meetings[0]!.fileKey).toBe("20240912-kaigiroku");
    expect(meetings[0]!.yearPageUrl).toBe(yearPageUrl);
  });

  it("「会議録」を含まないリンクは除外する", () => {
    const html = `
      <h2>令和６年第３回定例会（令和６年９月）</h2>
      <p><a href="files/schedule.pdf">会期日程.pdf</a></p>
      <p><a href="files/gian.pdf">議案目録.pdf</a></p>
      <p><a href="files/kekka.pdf">会議結果.pdf</a></p>
    `;

    const meetings = parseYearPage(html, yearPageUrl);
    expect(meetings).toHaveLength(0);
  });

  it("複数の定例会セクションから会議録リンクをそれぞれ抽出する", () => {
    const html = `
      <h2>令和６年第３回定例会（令和６年９月）</h2>
      <p><a href="files/2024_9_kaigiroku.pdf">会議録（一般質問）</a></p>
      <p><a href="files/2024_9_kekka.pdf">会議結果.pdf</a></p>
      <h2>令和６年第２回定例会（令和６年６月）</h2>
      <p><a href="files/2024_6_teirei_kaigiroku.pdf">会議録（一般質問）</a></p>
      <p><a href="files/2024_6_kekka.pdf">会議結果.pdf</a></p>
    `;

    const meetings = parseYearPage(html, yearPageUrl);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-09-01");
    expect(meetings[0]!.fileKey).toBe("2024_9_kaigiroku");
    expect(meetings[1]!.heldOn).toBe("2024-06-01");
    expect(meetings[1]!.fileKey).toBe("2024_6_teirei_kaigiroku");
  });

  it("臨時会（会議録なし）のセクションは結果に含まれない", () => {
    const html = `
      <h2>令和６年第３回定例会（令和６年９月）</h2>
      <p><a href="files/2024_9_kaigiroku.pdf">会議録（一般質問）</a></p>
      <h2>令和６年第２回臨時会（令和６年８月２６日）</h2>
      <p><a href="files/2024_8_gian.pdf">議案目録.pdf</a></p>
      <p><a href="files/2024_8_kekka.pdf">会議結果.pdf</a></p>
    `;

    const meetings = parseYearPage(html, yearPageUrl);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和６年第３回定例会（令和６年９月）");
  });

  it("タイムスタンプ形式のファイル名でも絶対 URL を正しく構築する", () => {
    const html = `
      <h2>令和６年第４回定例会（令和６年１２月）</h2>
      <p><a href="files/20250314-150432.pdf">会議録（一般質問）</a></p>
    `;

    const meetings = parseYearPage(html, yearPageUrl);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/files/20250314-150432.pdf",
    );
    expect(meetings[0]!.fileKey).toBe("20250314-150432");
    expect(meetings[0]!.heldOn).toBe("2024-12-01");
  });

  it("h2 がない場合は空配列を返す", () => {
    const html = `<div><p>コンテンツなし</p></div>`;
    const meetings = parseYearPage(html, yearPageUrl);
    expect(meetings).toHaveLength(0);
  });
});
