import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseDateText } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/administration/parliament/proceedings/proceedings8.html">令和８年　会議録</a></li>
        <li><a href="/administration/parliament/proceedings/proceedings7.html">令和７年　会議録</a></li>
        <li><a href="/administration/parliament/proceedings/proceedings.html">令和６年　会議録</a></li>
        <li><a href="/administration/parliament/proceedings/r5.html">令和５年　会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(
      html,
      "https://town.biei.hokkaido.jp/administration/parliament/proceedings/"
    );

    expect(pages).toHaveLength(4);
    expect(pages[0]!.label).toBe("令和8年　会議録");
    expect(pages[0]!.url).toBe(
      "https://town.biei.hokkaido.jp/administration/parliament/proceedings/proceedings8.html"
    );
    expect(pages[1]!.label).toBe("令和7年　会議録");
    expect(pages[2]!.label).toBe("令和6年　会議録");
    expect(pages[3]!.label).toBe("令和5年　会議録");
  });

  it("平成のリンクも抽出する", () => {
    const html = `
      <a href="/administration/parliament/proceedings/h31.html">平成31年（令和元年）　会議録</a>
      <a href="/administration/parliament/proceedings/h30.html">平成30年　会議録</a>
    `;

    const pages = parseTopPage(
      html,
      "https://town.biei.hokkaido.jp/administration/parliament/proceedings/"
    );

    expect(pages).toHaveLength(2);
    expect(pages[0]!.label).toBe("平成31年（令和元年）　会議録");
    expect(pages[1]!.label).toBe("平成30年　会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/some-page.html">お知らせ</a>
      <a href="/administration/parliament/proceedings/r5.html">令和５年　会議録</a>
    `;

    const pages = parseTopPage(
      html,
      "https://town.biei.hokkaido.jp/administration/parliament/proceedings/"
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和5年　会議録");
  });
});

describe("parseDateText", () => {
  it("全角数字の令和の日付をパースする", () => {
    expect(parseDateText("令和７年１２月１１日（木）開催")).toBe("2025-12-11");
  });

  it("半角数字の令和の日付をパースする", () => {
    expect(parseDateText("令和5年2月27日（月曜日）開催")).toBe("2023-02-27");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成30年3月5日（月）開催")).toBe("2018-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("議案")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://town.biei.hokkaido.jp/administration/parliament/proceedings/proceedings7.html";

  it("h3 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>第７回定例会（12月11日～12日）</h3>
      <p>
        <a href="/files/00006100/00006131/20260319165306.pdf">令和７年１２月１１日（木）開催</a>PDF(1.19 MB)<br>
        <a href="/files/00006100/00006131/20260225162616.pdf">令和７年１２月１２日（金）開催</a>PDF(930.69 KB)<br>
        <a href="/files/00006100/00006131/20251224140841.pdf">議案</a>PDF(1.17 MB)<br>
        <a href="/files/00006100/00006131/20251225084923.pdf">資料</a>PDF(395.26 KB)<br>
        <a href="/files/00006100/00006131/20260130151612.pdf">審議結果</a>PDF(100.99 KB)
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.section).toBe("第７回定例会（12月11日～12日）");
    expect(meetings[0]!.heldOn).toBe("2025-12-11");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://town.biei.hokkaido.jp/files/00006100/00006131/20260319165306.pdf"
    );

    expect(meetings[1]!.heldOn).toBe("2025-12-12");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://town.biei.hokkaido.jp/files/00006100/00006131/20260225162616.pdf"
    );
  });

  it("臨時会セクションも正しく抽出する", () => {
    const html = `
      <h3>第６回臨時会（11月28日）</h3>
      <p>
        <a href="/files/00006100/00006131/20260119145334.pdf">令和７年１１月２８日（金）開催</a>PDF(569.00 KB)
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("第６回臨時会（11月28日）");
  });

  it("委員会セクションも正しく抽出する", () => {
    const html = `
      <h3>産業経済常任委員会（３月４日）</h3>
      <p>
        <a href="/files/00006500/00006508/20260319161550.pdf">令和８年３月４日（水）開催</a>PDF(215.78 KB)
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("産業経済常任委員会（３月４日）");
  });

  it("議案・資料・審議結果のリンクはスキップする", () => {
    const html = `
      <h3>第１回定例会（2月27日～3月16日）</h3>
      <p>
        <a href="/files/00005100/00005171/20230227_kaigiroku.pdf">令和5年2月27日（月曜日）開催</a>PDF(500KB)<br>
        <a href="/files/00005100/00005171/20230227_gian1.pdf">議案</a>PDF(100KB)<br>
        <a href="/files/00005100/00005171/20230227_gian_shiryo.pdf">資料</a>PDF(200KB)<br>
        <a href="/files/00005100/00005171/20230316_shingikekka.pdf">審議結果</a>PDF(50KB)
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-02-27");
  });

  it("kaigiroku を含むファイル名のリンクも対象になる", () => {
    const html = `
      <h3>第３回臨時会（5月29日）</h3>
      <p>
        <a href="/files/00005100/00005171/kaigiroku2305.pdf">令和５年５月２９日（月曜日）開催</a>PDF(300KB)
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2023-05-29");
  });

  it("複数セクションで正しいセクション名が紐付く", () => {
    const html = `
      <h3>第7回定例会（12月14日～12月15日）</h3>
      <p>
        <a href="/files/00005100/00005171/20250108150408.pdf">令和５年１２月１４日（木）開催</a>PDF(500KB)
      </p>
      <h3>第６回臨時会（11月27日）</h3>
      <p>
        <a href="/files/00005100/00005171/20250108150441.pdf">令和５年１１月２７日（月）開催</a>PDF(400KB)
      </p>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.section).toBe("第7回定例会（12月14日～12月15日）");
    expect(meetings[1]!.section).toBe("第６回臨時会（11月27日）");
  });
});
