import { describe, expect, it } from "vitest";
import { parsePdfLinks, parseIssueNumber, parsePublishDate, resolveUrl } from "./list";

describe("parseIssueNumber", () => {
  it("半角英数字の号数をパースする", () => {
    expect(parseIssueNumber("NO.208号（令和8年2月発行）")).toBe(208);
  });

  it("全角英字の号数をパースする", () => {
    expect(parseIssueNumber("ＮＯ.140号（平成21年2月発行）")).toBe(140);
  });

  it("全角数字の号数をパースする", () => {
    expect(parseIssueNumber("NO.１７０号（平成28年8月発行）")).toBe(170);
  });

  it("ピリオドなしの表記をパースする", () => {
    expect(parseIssueNumber("NO208号（令和6年2月発行）")).toBe(208);
  });

  it("号数が含まれない場合は null を返す", () => {
    expect(parseIssueNumber("議会だより（令和6年2月発行）")).toBeNull();
  });
});

describe("parsePublishDate", () => {
  it("令和年月をパースする", () => {
    const result = parsePublishDate("NO.208号（令和8年2月発行）");
    expect(result).toEqual({ year: 2026, month: 2 });
  });

  it("令和元年をパースする", () => {
    const result = parsePublishDate("NO.183号（令和元年8月発行）");
    expect(result).toEqual({ year: 2019, month: 8 });
  });

  it("平成年月をパースする", () => {
    const result = parsePublishDate("NO.140号（平成21年2月発行）");
    expect(result).toEqual({ year: 2009, month: 2 });
  });

  it("全角数字の年月をパースする", () => {
    const result = parsePublishDate("NO.１９０号（令和３年８月発行）");
    expect(result).toEqual({ year: 2021, month: 8 });
  });

  it("年月が含まれない場合は null を返す", () => {
    const result = parsePublishDate("議会だより");
    expect(result).toBeNull();
  });
});

describe("resolveUrl", () => {
  it("相対パスを絶対 URL に変換する", () => {
    const result = resolveUrl(
      "../common/img/content/cassette_1_pdf01_20160913_174423.pdf",
      "http://www.town.suttu.lg.jp/town/detail.php?id=63",
    );
    expect(result).toBe(
      "http://www.town.suttu.lg.jp/common/img/content/cassette_1_pdf01_20160913_174423.pdf",
    );
  });

  it("絶対 URL はそのまま返す", () => {
    const url = "http://www.town.suttu.lg.jp/common/img/content/cassette_7_pdf09_20260205_090028.pdf";
    const result = resolveUrl(url, "http://www.town.suttu.lg.jp/town/detail.php?id=63");
    expect(result).toBe(url);
  });

  it("複数の ../ プレフィックスを正規化する", () => {
    const result = resolveUrl(
      "../../common/img/content/test.pdf",
      "http://www.town.suttu.lg.jp/town/detail.php?id=63",
    );
    expect(result).toBe("http://www.town.suttu.lg.jp/common/img/content/test.pdf");
  });
});

describe("parsePdfLinks", () => {
  it("ul.pdf-list から PDF リンクを抽出する", () => {
    const html = `
      <ul class="pdf-list" id="content-1">
        <li><a href="../common/img/content/cassette_1_pdf01_20160913_174423.pdf" target="_blank">NO.140号（平成21年2月発行）</a></li>
        <li><a href="../common/img/content/cassette_1_pdf02_20160913_174500.pdf" target="_blank">NO.141号（平成21年5月発行）</a></li>
      </ul>
    `;

    const results = parsePdfLinks(html, "http://www.town.suttu.lg.jp/town/detail.php?id=63");

    expect(results).toHaveLength(2);
    expect(results[0]!.pdfUrl).toBe(
      "http://www.town.suttu.lg.jp/common/img/content/cassette_1_pdf01_20160913_174423.pdf",
    );
    expect(results[0]!.linkText).toBe("NO.140号（平成21年2月発行）");
    expect(results[0]!.issueNumber).toBe(140);
    expect(results[0]!.publishYear).toBe(2009);
    expect(results[0]!.publishMonth).toBe(2);
    expect(results[1]!.issueNumber).toBe(141);
    expect(results[1]!.publishMonth).toBe(5);
  });

  it("複数の ul.pdf-list から PDF リンクを収集する", () => {
    const html = `
      <ul class="pdf-list" id="content-1">
        <li><a href="../common/img/content/cassette_1_pdf01_20160913_174423.pdf">NO.140号（平成21年2月発行）</a></li>
      </ul>
      <ul class="pdf-list" id="content-7">
        <li><a href="../common/img/content/cassette_7_pdf09_20260205_090028.pdf">NO.208号（令和8年2月発行）</a></li>
      </ul>
    `;

    const results = parsePdfLinks(html, "http://www.town.suttu.lg.jp/town/detail.php?id=63");

    expect(results).toHaveLength(2);
    expect(results[0]!.issueNumber).toBe(140);
    expect(results[1]!.issueNumber).toBe(208);
    expect(results[1]!.publishYear).toBe(2026);
  });

  it("pdf-list がない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const results = parsePdfLinks(html, "http://www.town.suttu.lg.jp/town/detail.php?id=63");
    expect(results).toHaveLength(0);
  });

  it("号数・発行年月が解析できないリンクも含める", () => {
    const html = `
      <ul class="pdf-list" id="content-1">
        <li><a href="../common/img/content/cassette_1_pdf01_20160913_174423.pdf">議会だより</a></li>
      </ul>
    `;

    const results = parsePdfLinks(html, "http://www.town.suttu.lg.jp/town/detail.php?id=63");

    expect(results).toHaveLength(1);
    expect(results[0]!.issueNumber).toBeNull();
    expect(results[0]!.publishYear).toBeNull();
    expect(results[0]!.publishMonth).toBeNull();
  });
});
