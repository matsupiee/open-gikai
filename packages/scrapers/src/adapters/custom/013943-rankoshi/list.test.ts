import { describe, expect, it } from "vitest";
import { parseYearListPage, parseDateFromLinkText, parseYearPage } from "./list";

describe("parseYearListPage", () => {
  it("ul.c-circleList から年度別ページの URL を抽出する", () => {
    const html = `
      <ul class="c-circleList">
        <li><a href="/administration/town/detail.html?content=867" target="_blank">令和８年　蘭越町議会会議録</a></li>
        <li><a href="/administration/town/detail.html?content=778" target="_blank">令和７年　蘭越町議会会議録</a></li>
        <li><a href="/administration/town/detail.html?content=656" target="_blank">令和６年　蘭越町議会会議録</a></li>
      </ul>
    `;

    const results = parseYearListPage(html);

    expect(results).toHaveLength(3);
    expect(results[0]!.contentId).toBe(867);
    expect(results[0]!.year).toBe(2026);
    expect(results[0]!.url).toBe(
      "https://www.town.rankoshi.hokkaido.jp/administration/town/detail.html?content=867",
    );
    expect(results[1]!.contentId).toBe(778);
    expect(results[1]!.year).toBe(2025);
    expect(results[2]!.contentId).toBe(656);
    expect(results[2]!.year).toBe(2024);
  });

  it("令和元年のリンクを正しくパースする", () => {
    const html = `
      <ul class="c-circleList">
        <li><a href="/administration/town/detail.html?content=299" target="_blank">令和元年　蘭越町議会会議録</a></li>
      </ul>
    `;

    const results = parseYearListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.year).toBe(2019);
  });

  it("content=301 のリンクはスキップする", () => {
    const html = `
      <ul class="c-circleList">
        <li><a href="/administration/town/detail.html?content=301">会議録一覧</a></li>
        <li><a href="/administration/town/detail.html?content=656">令和６年　蘭越町議会会議録</a></li>
      </ul>
    `;

    const results = parseYearListPage(html);

    expect(results).toHaveLength(1);
    expect(results[0]!.contentId).toBe(656);
  });

  it("c-circleList がない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const results = parseYearListPage(html);
    expect(results).toHaveLength(0);
  });
});

describe("parseDateFromLinkText", () => {
  it("全角数字の日付をパースする", () => {
    const result = parseDateFromLinkText("１２月１２日　１日目(PDF／466KB)", 2024);
    expect(result).toBe("2024-12-12");
  });

  it("半角・全角混在の日付をパースする", () => {
    const result = parseDateFromLinkText("9月１７日　１日目(PDF／500KB)", 2024);
    expect(result).toBe("2024-09-17");
  });

  it("半角数字のみの日付をパースする", () => {
    const result = parseDateFromLinkText("3月10日　1日目(PDF／300KB)", 2025);
    expect(result).toBe("2025-03-10");
  });

  it("1桁月・1桁日をパースする", () => {
    const result = parseDateFromLinkText("６月２日　１日目(PDF／400KB)", 2024);
    expect(result).toBe("2024-06-02");
  });

  it("日付が含まれない場合は null を返す", () => {
    const result = parseDateFromLinkText("会議録(PDF／400KB)", 2024);
    expect(result).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("年度別ページから会議録情報を抽出する", () => {
    const html = `
      <div class="index_block _block cassette-item">
        <h1 class="c-secTtl">
          <span class="c-secTtl_label">令和６年蘭越町議会第４回定例会</span>
        </h1>
      </div>
      <div class="list_block _block cassette-item list02">
        <ul class="c-fileList">
          <li><a href="../../common/img/content/content_20250120_111334.pdf" target="_blank">１２月１２日　１日目(PDF／466KB)</a></li>
          <li><a href="../../common/img/content/content_20250121_095500.pdf" target="_blank">１２月１３日　２日目(PDF／520KB)</a></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html, 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("令和６年蘭越町議会第４回定例会");
    expect(results[0]!.heldOn).toBe("2024-12-12");
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.rankoshi.hokkaido.jp/common/img/content/content_20250120_111334.pdf",
    );
    expect(results[0]!.year).toBe(2024);
    expect(results[1]!.heldOn).toBe("2024-12-13");
  });

  it("複数の会議種別が含まれる場合も正しく紐付ける", () => {
    const html = `
      <div class="index_block _block cassette-item">
        <h1 class="c-secTtl">
          <span class="c-secTtl_label">令和６年蘭越町議会第１回定例会</span>
        </h1>
      </div>
      <div class="list_block _block cassette-item list02">
        <ul class="c-fileList">
          <li><a href="../../common/img/content/content_20240315_100000.pdf">３月１５日　１日目(PDF／400KB)</a></li>
        </ul>
      </div>
      <div class="index_block _block cassette-item">
        <h1 class="c-secTtl">
          <span class="c-secTtl_label">令和６年蘭越町議会第１回臨時会</span>
        </h1>
      </div>
      <div class="list_block _block cassette-item list02">
        <ul class="c-fileList">
          <li><a href="../../common/img/content/content_20240210_090000.pdf">２月１０日　１日目(PDF／300KB)</a></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html, 2024);

    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("令和６年蘭越町議会第１回定例会");
    expect(results[0]!.heldOn).toBe("2024-03-15");
    expect(results[1]!.title).toBe("令和６年蘭越町議会第１回臨時会");
    expect(results[1]!.heldOn).toBe("2024-02-10");
  });

  it("「年度」表記の見出しも正しくパースする", () => {
    const html = `
      <div class="index_block _block cassette-item">
        <h1 class="c-secTtl">
          <span class="c-secTtl_label">令和６年度蘭越町議会第２回定例会</span>
        </h1>
      </div>
      <div class="list_block _block cassette-item list02">
        <ul class="c-fileList">
          <li><a href="../../common/img/content/content_20240610_110000.pdf">６月１０日　１日目(PDF／450KB)</a></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html, 2024);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("令和６年度蘭越町議会第２回定例会");
    expect(results[0]!.heldOn).toBe("2024-06-10");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const results = parseYearPage(html, 2024);
    expect(results).toHaveLength(0);
  });

  it("絶対 URL の href はそのまま使用する", () => {
    const html = `
      <div class="index_block _block cassette-item">
        <h1 class="c-secTtl">
          <span class="c-secTtl_label">令和６年蘭越町議会第３回定例会</span>
        </h1>
      </div>
      <div class="list_block _block cassette-item list02">
        <ul class="c-fileList">
          <li><a href="https://www.town.rankoshi.hokkaido.jp/common/img/content/content_20240920_100000.pdf">９月２０日　１日目(PDF／480KB)</a></li>
        </ul>
      </div>
    `;

    const results = parseYearPage(html, 2024);

    expect(results).toHaveLength(1);
    expect(results[0]!.pdfUrl).toBe(
      "https://www.town.rankoshi.hokkaido.jp/common/img/content/content_20240920_100000.pdf",
    );
  });
});
