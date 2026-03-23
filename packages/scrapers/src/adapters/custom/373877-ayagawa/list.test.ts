import { describe, it, expect } from "vitest";
import { parseIndexPage, parseMeetingPage, parseSubPage } from "./list";

describe("parseIndexPage", () => {
  it("年度別の会議ページリンクを抽出する", () => {
    const html = `
      <div>
        <h3>令和7年度　定例会・臨時会（令和7年4月1日～令和8年3月31日）</h3>
        <a href="r76gatsuteireikai.html">6月定例会</a>
        <a href="r79gatsuteireikai.html">9月定例会</a>
        <a href="r712gatsuteireikai.html">12月定例会</a>
        <a href="r75gatsurinjikai.html">5月臨時会</a>
        <h3>令和6年度　定例会・臨時会（令和6年4月1日～令和7年3月31日）</h3>
        <a href="r66gatsuteireikai.html">6月定例会</a>
        <a href="r6nen9gatsuteireikai.html">9月定例会</a>
        <a href="r612gatsuteireikai.html">12月定例会</a>
        <a href="202503teireikai.html">3月定例会</a>
        <a href="r65gatsurinnjikai.html">5月臨時会</a>
      </div>
    `;

    const results = parseIndexPage(html);

    expect(results).toHaveLength(9);

    // 令和7年度
    expect(results[0]!.fiscalYear).toBe(2025);
    expect(results[0]!.meetingName).toBe("6月定例会");
    expect(results[0]!.url).toBe("https://ayagawa-gikai.jp/r76gatsuteireikai.html");

    expect(results[1]!.fiscalYear).toBe(2025);
    expect(results[1]!.meetingName).toBe("9月定例会");

    expect(results[2]!.fiscalYear).toBe(2025);
    expect(results[2]!.meetingName).toBe("12月定例会");

    expect(results[3]!.fiscalYear).toBe(2025);
    expect(results[3]!.meetingName).toBe("5月臨時会");

    // 令和6年度
    expect(results[4]!.fiscalYear).toBe(2024);
    expect(results[4]!.meetingName).toBe("6月定例会");

    expect(results[7]!.fiscalYear).toBe(2024);
    expect(results[7]!.meetingName).toBe("3月定例会");

    expect(results[8]!.fiscalYear).toBe(2024);
    expect(results[8]!.meetingName).toBe("5月臨時会");
  });

  it("teireikai.html 自身へのナビゲーションリンクはスキップする", () => {
    const html = `
      <nav>
        <a href="teireikai.html">定例会・臨時会</a>
      </nav>
      <div>
        <h3>令和7年度　定例会・臨時会</h3>
        <a href="r76gatsuteireikai.html">6月定例会</a>
      </div>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.meetingName).toBe("6月定例会");
  });

  it("年度見出しがない場合は空配列を返す", () => {
    const html = `
      <div>
        <a href="r76gatsuteireikai.html">6月定例会</a>
      </div>
    `;

    const results = parseIndexPage(html);
    expect(results).toHaveLength(0);
  });
});

describe("parseMeetingPage", () => {
  const PAGE_URL = "https://ayagawa-gikai.jp/r712gatsuteireikai.html";

  it("本会議録 PDF リンクとサブページリンクを抽出する", () => {
    const html = `
      <div>
        <a href="index.html">綾川町議会</a>
        <a href="teireikai.html">定例会・臨時会</a>
        <h2>令和７年１２月定例会</h2>
        <a href="img/file47.pdf">会議録（PDF）</a>
        <a href="r7nenn12gatsuippanshitsumonn.html">一般質問</a>
        <a href="r7nenn12gatsuiinkai.html">常任委員会</a>
        <a href="r7kessaniinnkai.html">決算審査特別委員会</a>
        <a href="sitemap.html">サイトマップ</a>
      </div>
    `;

    const { pdfLinks, subPages } = parseMeetingPage(html, PAGE_URL);

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.url).toBe("https://ayagawa-gikai.jp/img/file47.pdf");
    expect(pdfLinks[0]!.text).toBe("会議録（PDF）");

    expect(subPages).toHaveLength(3);
    expect(subPages[0]!.url).toBe(
      "https://ayagawa-gikai.jp/r7nenn12gatsuippanshitsumonn.html"
    );
    expect(subPages[0]!.text).toBe("一般質問");
    expect(subPages[1]!.url).toBe(
      "https://ayagawa-gikai.jp/r7nenn12gatsuiinkai.html"
    );
    expect(subPages[1]!.text).toBe("常任委員会");
    expect(subPages[2]!.url).toBe(
      "https://ayagawa-gikai.jp/r7kessaniinnkai.html"
    );
    expect(subPages[2]!.text).toBe("決算審査特別委員会");
  });

  it("PDF リンクのみのページを正しく処理する", () => {
    const html = `
      <div>
        <a href="img/202406kaigiroku2.pdf">会議録（PDF）</a>
      </div>
    `;

    const { pdfLinks, subPages } = parseMeetingPage(html, PAGE_URL);

    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0]!.url).toBe(
      "https://ayagawa-gikai.jp/img/202406kaigiroku2.pdf"
    );
    expect(subPages).toHaveLength(0);
  });

  it("ナビゲーションリンクを除外する", () => {
    const html = `
      <a href="index.html">綾川町議会</a>
      <a href="greeting.html">議長あいさつ</a>
      <a href="profile.html">議員紹介</a>
      <a href="img/202506kaigiroku.pdf">会議録（PDF）</a>
    `;

    const { pdfLinks } = parseMeetingPage(html, PAGE_URL);
    expect(pdfLinks).toHaveLength(1);
  });
});

describe("parseSubPage", () => {
  const PAGE_URL =
    "https://ayagawa-gikai.jp/r7nenn12gatsuippanshitsumonn.html";

  it("一般質問ページから PDF リンクを抽出する", () => {
    const html = `
      <table>
        <tr>
          <td>植田 誠司</td>
          <td><a href="img/file36.pdf">一般質問会議録</a></td>
        </tr>
        <tr>
          <td>森 繁樹</td>
          <td><a href="img/file37.pdf">一般質問会議録</a></td>
        </tr>
      </table>
    `;

    const { pdfLinks } = parseSubPage(html, PAGE_URL);

    expect(pdfLinks).toHaveLength(2);
    expect(pdfLinks[0]!.url).toBe("https://ayagawa-gikai.jp/img/file36.pdf");
    expect(pdfLinks[0]!.text).toBe("一般質問会議録");
    expect(pdfLinks[1]!.url).toBe("https://ayagawa-gikai.jp/img/file37.pdf");
  });

  it("委員会ページからサブページリンクを抽出する", () => {
    const html = `
      <div>
        <a href="r7nenn12gatsusoumuiinnkai.html">総務常任委員会</a>
        <a href="r7nenn12gatsukouseiiinnkai.html">厚生常任委員会</a>
      </div>
    `;

    const { pdfLinks, subPages } = parseSubPage(html, PAGE_URL);

    expect(pdfLinks).toHaveLength(0);
    expect(subPages).toHaveLength(2);
    expect(subPages[0]!.text).toBe("総務常任委員会");
    expect(subPages[1]!.text).toBe("厚生常任委員会");
  });

  it("ナビゲーションリンクを除外する", () => {
    const html = `
      <a href="index.html">綾川町議会</a>
      <a href="teireikai.html">定例会・臨時会</a>
      <a href="img/file36.pdf">一般質問会議録</a>
    `;

    const { pdfLinks, subPages } = parseSubPage(html, PAGE_URL);
    expect(pdfLinks).toHaveLength(1);
    expect(subPages).toHaveLength(0);
  });
});
