import { describe, expect, it } from "vitest";
import {
  parseTeireiLinkText,
  parseRinjiLinkText,
  parseTopPage,
  parseMeetingPage,
} from "./list";

describe("parseTeireiLinkText", () => {
  it("定例会リンクテキストをパースする（全角月数字・ファイルサイズ付き）", () => {
    const result = parseTeireiLinkText("令和６年１２月　定例会（３日目）(351.6 KB)");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-12-01");
    expect(result!.meetingType).toBe("plenary");
    expect(result!.title).toBe("令和６年１２月 定例会（３日目）");
  });

  it("定例会リンクテキストをパースする（半角数字）", () => {
    const result = parseTeireiLinkText("令和5年3月　定例会（1日目）");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2023-03-01");
    expect(result!.meetingType).toBe("plenary");
  });

  it("平成年号の定例会をパースする", () => {
    const result = parseTeireiLinkText("平成30年3月定例会（2日目）");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2018-03-01");
    expect(result!.meetingType).toBe("plenary");
  });

  it("定例会以外は null を返す", () => {
    expect(parseTeireiLinkText("令和６年11月臨時会")).toBeNull();
    expect(parseTeireiLinkText("随意契約の概要")).toBeNull();
  });
});

describe("parseRinjiLinkText", () => {
  it("臨時会リンクテキストをパースする（全角月数字・ファイルサイズ付き）", () => {
    const result = parseRinjiLinkText("令和６年１１月　臨時会(373.1 KB)");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2024-11-01");
    expect(result!.meetingType).toBe("extraordinary");
    expect(result!.title).toBe("令和６年１１月 臨時会");
  });

  it("半角数字の臨時会もパースする", () => {
    const result = parseRinjiLinkText("令和5年1月　臨時会");
    expect(result).not.toBeNull();
    expect(result!.heldOn).toBe("2023-01-01");
    expect(result!.meetingType).toBe("extraordinary");
  });

  it("臨時会以外は null を返す", () => {
    expect(parseRinjiLinkText("令和６年12月　定例会（3日目）")).toBeNull();
  });
});

describe("parseTopPage", () => {
  it("定例会・臨時会のリンクを抽出する", () => {
    const html = `
      <html><body>
      <h1>令和6年</h1>
      <div class="entry">
        <ul>
          <li><a href="../../../parliament/record/r-teirei/post-954.html">令和６年定例会</a></li>
          <li><a href="../../../parliament/record/r-rinji/post-939.html">令和６年臨時会</a></li>
        </ul>
      </div>
      <h1>令和5年</h1>
      <div class="entry">
        <ul>
          <li><a href="../../../parliament/record/r-teirei/post-747.html">令和５年定例会</a></li>
        </ul>
      </div>
      </body></html>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(3);

    const teirei = results.filter((r) => r.meetingType === "plenary");
    expect(teirei).toHaveLength(2);

    const rinji = results.filter((r) => r.meetingType === "extraordinary");
    expect(rinji).toHaveLength(1);
  });

  it("定例会・臨時会以外のリンクは含まない", () => {
    const html = `
      <html><body>
      <a href="/about.html">自治体について</a>
      <a href="/cat05/c5-11/post_267/">会議録トップ</a>
      <a href="../record/r-teirei/post-954.html">令和６年定例会</a>
      </body></html>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.meetingType).toBe("plenary");
  });

  it("絶対 URL はそのまま使用する", () => {
    const html = `
      <a href="https://www.kawatana.jp/parliament/record/r-teirei/post-954.html">令和６年定例会</a>
    `;

    const results = parseTopPage(html);
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("https://www.kawatana.jp/parliament/record/r-teirei/post-954.html");
  });
});

describe("parseMeetingPage", () => {
  it("定例会ページから PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <h1>令和６年　定例会</h1>
      <div>
        <a href="/item/2d7f70b24c95d3f48df40a87a9479235.pdf">令和６年12月　定例会（3日目）</a>
        <a href="/item/86ddfb0c73fdc47c1c18df09f1d92b6f_1.pdf">令和６年12月　定例会（2日目）</a>
        <a href="/item/1009e22b6da9561d6b482798631da9b8_4.pdf">令和６年12月　定例会（1日目）</a>
        <a href="/item/abc.pdf">令和６年9月　定例会（1日目）</a>
      </div>
      </body></html>
    `;

    const results = parseMeetingPage(html, "plenary", "https://www.kawatana.jp/parliament/record/r-teirei/post-954.html");
    expect(results).toHaveLength(4);

    expect(results[0]!.pdfUrl).toBe("https://www.kawatana.jp/item/2d7f70b24c95d3f48df40a87a9479235.pdf");
    expect(results[0]!.heldOn).toBe("2024-12-01");
    expect(results[0]!.meetingType).toBe("plenary");
    expect(results[0]!.title).toBe("令和６年12月 定例会（3日目）");

    expect(results[3]!.heldOn).toBe("2024-09-01");
  });

  it("臨時会ページから PDF リンクを抽出する", () => {
    const html = `
      <html><body>
      <a href="/item/xyz.pdf">令和６年11月臨時会</a>
      </body></html>
    `;

    const results = parseMeetingPage(html, "extraordinary", "https://www.kawatana.jp/parliament/record/r-rinji/post-939.html");
    expect(results).toHaveLength(1);
    expect(results[0]!.meetingType).toBe("extraordinary");
    expect(results[0]!.heldOn).toBe("2024-11-01");
  });

  it("PDF 以外のリンクは含まない", () => {
    const html = `
      <html><body>
      <a href="/about.html">サイト概要</a>
      <a href="/item/abc.pdf">令和６年12月　定例会（1日目）</a>
      </body></html>
    `;

    const results = parseMeetingPage(html, "plenary", "https://www.kawatana.jp/parliament/record/r-teirei/post-954.html");
    expect(results).toHaveLength(1);
  });

  it("マッチしないリンクテキストの PDF は含まない", () => {
    const html = `
      <html><body>
      <a href="/item/abc.pdf">会議録はこちら</a>
      </body></html>
    `;

    const results = parseMeetingPage(html, "plenary", "https://www.kawatana.jp/parliament/record/r-teirei/post-954.html");
    expect(results).toHaveLength(0);
  });

  it("リンクテキスト内にアイコン HTML タグが含まれていても正しくパースする", () => {
    const html = `
      <html><body>
      <p><a href="/item/2d7f70b24c95d3f48df40a87a9479235.pdf" class="btn btn-tag pdf btn-tag--favorite"><i class="fas fa-file-pdf"></i>令和６年１２月　定例会（３日目）(351.6 KB)</a></p>
      <p><a href="/item/86ddfb0c73fdc47c1c18df09f1d92b6f_1.pdf" class="btn btn-tag pdf btn-tag--favorite"><i class="fas fa-file-pdf"></i>令和６年１２月　定例会（２日目）(383.0 KB)</a></p>
      </body></html>
    `;

    const results = parseMeetingPage(html, "plenary", "https://www.kawatana.jp/parliament/record/r-teirei/post-954.html");
    expect(results).toHaveLength(2);
    expect(results[0]!.pdfUrl).toBe("https://www.kawatana.jp/item/2d7f70b24c95d3f48df40a87a9479235.pdf");
    expect(results[0]!.heldOn).toBe("2024-12-01");
    expect(results[0]!.title).toBe("令和６年１２月 定例会（３日目）");
    expect(results[1]!.heldOn).toBe("2024-12-01");
  });
});
