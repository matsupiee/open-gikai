import { describe, expect, it } from "vitest";
import {
  parseYearDirLinks,
  parseMeetingLinks,
  parsePdfLinks,
  parseSessionLabel,
  extractSessionRecords,
} from "./list";

describe("parseYearDirLinks", () => {
  it("令和・平成の年度ディレクトリリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="./R8/index.html">令和8年</a></li>
        <li><a href="./R6/index.html">令和6年</a></li>
        <li><a href="./R2/index.html">令和2年</a></li>
        <li><a href="./h31/index.html">平成31年</a></li>
        <li><a href="./h22/index.html">平成22年</a></li>
      </ul>
    `;

    const links = parseYearDirLinks(html);

    expect(links).toHaveLength(5);
    expect(links[0]!.dir).toBe("R8");
    expect(links[0]!.year).toBe(2026);
    expect(links[1]!.dir).toBe("R6");
    expect(links[1]!.year).toBe(2024);
    expect(links[2]!.dir).toBe("R2");
    expect(links[2]!.year).toBe(2020);
    expect(links[3]!.dir).toBe("h31");
    expect(links[3]!.year).toBe(2019);
    expect(links[4]!.dir).toBe("h22");
    expect(links[4]!.year).toBe(2010);
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="./R6/index.html">令和6年</a>
      <a href="./R6/index.html">令和6年（再掲）</a>
    `;

    const links = parseYearDirLinks(html);
    expect(links).toHaveLength(1);
  });

  it("年度リンクがない場合は空配列を返す", () => {
    const html = `<html><body><p>会議録一覧</p></body></html>`;
    const links = parseYearDirLinks(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseMeetingLinks", () => {
  it("gikai-jimu/gikai/kaigi/ 配下のリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="../../../gikai-jimu/gikai/kaigi/20250411134013.html">第４回定例会（令和６年１２月）</a></li>
        <li><a href="../../../gikai-jimu/gikai/kaigi/20241224115111.html">第３回定例会（令和６年９月）</a></li>
      </ul>
    `;
    const baseUrl = "https://www.town.kanra.lg.jp/gikai/kaigiroku/R6/index.html";

    const links = parseMeetingLinks(html, baseUrl);

    expect(links).toHaveLength(2);
    expect(links[0]!.text).toBe("第４回定例会（令和６年１２月）");
    expect(links[0]!.url).toBe(
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20250411134013.html",
    );
    expect(links[1]!.text).toBe("第３回定例会（令和６年９月）");
  });

  it("重複リンクを除外する", () => {
    const html = `
      <a href="/gikai-jimu/gikai/kaigi/20250411134013.html">第４回定例会（令和６年１２月）</a>
      <a href="/gikai-jimu/gikai/kaigi/20250411134013.html">第４回定例会（令和６年１２月）</a>
    `;
    const baseUrl = "https://www.town.kanra.lg.jp/gikai/kaigiroku/R6/index.html";

    const links = parseMeetingLinks(html, baseUrl);
    expect(links).toHaveLength(1);
  });
});

describe("parsePdfLinks", () => {
  it("号別 PDF リンクを抽出し目次をスキップする", () => {
    const html = `
      <ul>
        <li><a href="./20241206mokuji.pdf">会議録目次（140 KB）</a></li>
        <li><a href="./202412061gou.pdf">第１号（１２月６日）（377 KB）</a></li>
        <li><a href="./202412122gou.pdf">第２号（１２月１２日）（1023 KB）</a></li>
      </ul>
    `;
    const detailPageUrl =
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20250411134013.html";

    const links = parsePdfLinks(html, detailPageUrl);

    expect(links).toHaveLength(2);
    expect(links[0]!.text).toBe("第１号（１２月６日）（377 KB）");
    expect(links[0]!.url).toBe(
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202412061gou.pdf",
    );
    expect(links[1]!.url).toBe(
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202412122gou.pdf",
    );
  });

  it("重複 PDF URL を除外する", () => {
    const html = `
      <a href="./202412061gou.pdf">第１号（377 KB）</a>
      <a href="./202412061gou.pdf">第１号（377 KB）</a>
    `;
    const detailPageUrl =
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20250411134013.html";

    const links = parsePdfLinks(html, detailPageUrl);
    expect(links).toHaveLength(1);
  });

  it("絶対パスの PDF URL をそのまま使う", () => {
    const html = `
      <a href="https://www.town.kanra.lg.jp/gikai-jimu/sozai/other/kaigi_220309.pdf">第1号（3月9日）</a>
    `;
    const detailPageUrl =
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/12345.html";

    const links = parsePdfLinks(html, detailPageUrl);
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe(
      "https://www.town.kanra.lg.jp/gikai-jimu/sozai/other/kaigi_220309.pdf",
    );
  });
});

describe("parseSessionLabel", () => {
  it("全角の号番号を半角に変換する", () => {
    expect(parseSessionLabel("第１号（１２月６日）（377 KB）")).toBe("第1号");
    expect(parseSessionLabel("第２号（１２月１２日）（1023 KB）")).toBe("第2号");
  });

  it("号番号がない場合は先頭部分を返す", () => {
    expect(parseSessionLabel("会議録（412 KB）")).toBe("会議録");
  });
});

describe("extractSessionRecords", () => {
  it("号別 PDF ごとにレコードを生成する", () => {
    const html = `
      <ul>
        <li><a href="./20241206mokuji.pdf">会議録目次（140 KB）</a></li>
        <li><a href="./202412061gou.pdf">第１号（１２月６日）（377 KB）</a></li>
        <li><a href="./202412122gou.pdf">第２号（１２月１２日）（1023 KB）</a></li>
      </ul>
    `;
    const detailPageUrl =
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20250411134013.html";
    const meetingTitle = "第４回定例会（令和６年１２月）";

    const records = extractSessionRecords(html, detailPageUrl, meetingTitle);

    expect(records).toHaveLength(2);
    expect(records[0]!.title).toBe("第４回定例会（令和６年１２月） 第1号");
    expect(records[0]!.heldOn).toBe("2024-12-06");
    expect(records[0]!.pdfUrl).toBe(
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/202412061gou.pdf",
    );
    expect(records[0]!.meetingType).toBe("plenary");
    expect(records[0]!.detailPageUrl).toBe(detailPageUrl);
    expect(records[0]!.sessionIndex).toBe(0);
    expect(records[1]!.heldOn).toBe("2024-12-12");
    expect(records[1]!.sessionIndex).toBe(1);
  });

  it("臨時会を extraordinary に分類する", () => {
    const html = `
      <a href="./202401151gou.pdf">第１号（1月15日）</a>
    `;
    const detailPageUrl =
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20240226100105.html";

    const records = extractSessionRecords(
      html,
      detailPageUrl,
      "第１回臨時会（令和６年１月）",
    );

    expect(records).toHaveLength(1);
    expect(records[0]!.meetingType).toBe("extraordinary");
  });

  it("PDF がない場合は空配列を返す", () => {
    const html = `<ul><li>会議録準備中</li></ul>`;
    const records = extractSessionRecords(
      html,
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/12345.html",
      "第１回定例会",
    );

    expect(records).toHaveLength(0);
  });

  it("heldOn が取得できない場合は null になる", () => {
    const html = `
      <a href="./r06_3t.mokuji.pdf">会議録目次</a>
      <a href="./r06_3t.1gou.pdf">第１号</a>
    `;
    const detailPageUrl =
      "https://www.town.kanra.lg.jp/gikai-jimu/gikai/kaigi/20241224115111.html";

    const records = extractSessionRecords(
      html,
      detailPageUrl,
      "第３回定例会（令和６年９月）",
    );

    // 目次はスキップ、号別のみ
    expect(records).toHaveLength(1);
    expect(records[0]!.heldOn).toBeNull();
  });
});
