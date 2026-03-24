import { describe, it, expect } from "vitest";
import {
  parseTopPage,
  parseYearPage,
  parseDateFromNewFormat,
  parseDateFromOldFormat,
  parseDateFromLinkText,
} from "./list";

describe("parseDateFromNewFormat", () => {
  it("R7.3.5 形式をパースする", () => {
    expect(parseDateFromNewFormat("R7.3.5令和7年第1回定例会(1日目)　会議録")).toBe("2025-03-05");
  });

  it("R7.3.12 形式をパースする（2桁の日）", () => {
    expect(parseDateFromNewFormat("R7.3.12令和7年第1回定例会(2日目)　会議録")).toBe("2025-03-12");
  });

  it("R6.12.5 形式をパースする（12月）", () => {
    expect(parseDateFromNewFormat("R6.12.5令和6年第4回定例会　会議録")).toBe("2024-12-05");
  });

  it("R 形式でない場合は null を返す", () => {
    expect(parseDateFromNewFormat("平成25年12月5日会議録")).toBeNull();
  });

  it("空文字列は null を返す", () => {
    expect(parseDateFromNewFormat("")).toBeNull();
  });
});

describe("parseDateFromOldFormat", () => {
  it("平成25年12月5日をパースする", () => {
    expect(parseDateFromOldFormat("平成25年12月5日会議録")).toBe("2013-12-05");
  });

  it("令和元年6月10日をパースする", () => {
    expect(parseDateFromOldFormat("令和元年6月10日会議録")).toBe("2019-06-10");
  });

  it("平成31年3月5日をパースする", () => {
    expect(parseDateFromOldFormat("平成31年3月5日会議録")).toBe("2019-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromOldFormat("会議録")).toBeNull();
  });
});

describe("parseDateFromLinkText", () => {
  it("新形式（R7.3.5）を優先してパースする", () => {
    expect(parseDateFromLinkText("R7.3.5令和7年第1回定例会(1日目)　会議録")).toBe("2025-03-05");
  });

  it("旧形式（平成XX年XX月XX日）をパースする", () => {
    expect(parseDateFromLinkText("平成25年12月5日会議録")).toBe("2013-12-05");
  });

  it("どちらの形式でもない場合は null を返す", () => {
    expect(parseDateFromLinkText("会議録")).toBeNull();
  });
});

describe("parseTopPage", () => {
  it("年度リンクを抽出する", () => {
    const html = `
      <div id="pb_main">
        <ul>
          <li><a href="gikai263.html">令和7年</a></li>
          <li><a href="gikai246.html">令和6年</a></li>
          <li><a href="gikai225.html">令和5年</a></li>
          <li><a href="gikai007.html">平成25年</a></li>
        </ul>
      </div>
    `;

    const links = parseTopPage(html);

    expect(links).toHaveLength(4);
    expect(links[0]!.text).toBe("令和7年");
    expect(links[0]!.url).toBe("http://www.town.toyo.kochi.jp/gikai-toyo/gikai263.html");
    expect(links[1]!.text).toBe("令和6年");
    expect(links[3]!.text).toBe("平成25年");
    expect(links[3]!.url).toBe("http://www.town.toyo.kochi.jp/gikai-toyo/gikai007.html");
  });

  it("特殊ページ（高知県知事審決結果、懲罰結果）はフィルタリングされる", () => {
    const html = `
      <div id="pb_main">
        <ul>
          <li><a href="gikai263.html">令和7年</a></li>
          <li><a href="gikai128.html">高知県知事審決結果</a></li>
          <li><a href="gikai086.html">懲罰結果</a></li>
        </ul>
      </div>
    `;

    const links = parseTopPage(html);

    expect(links).toHaveLength(1);
    expect(links[0]!.text).toBe("令和7年");
  });

  it("div#pb_main がない場合は空配列を返す", () => {
    const html = `<div><p>コンテンツなし</p></div>`;
    const links = parseTopPage(html);
    expect(links).toHaveLength(0);
  });

  it("リンクが0件の場合は空配列を返す", () => {
    const html = `<div id="pb_main"><ul></ul></div>`;
    const links = parseTopPage(html);
    expect(links).toHaveLength(0);
  });
});

describe("parseYearPage", () => {
  const PAGE_URL = "http://www.town.toyo.kochi.jp/gikai-toyo/gikai263.html";

  it("定例会の PDF リンクを抽出する", () => {
    const html = `
      <div id="pb_main">
        <div>
          <h3>令和７年第１回定例会　会議録</h3>
          <p class="pb_file"><a href="pbfile/m000263/pbf20250610133721_DBhHU3xbElHe.pdf" target="_blank">R7.3.5令和7年第1回定例会(1日目)　会議録</a>（1.55MB）</p>
          <p class="pb_file"><a href="pbfile/m000263/pbf20250610134457_eLA3oAUAAMdO.pdf" target="_blank">R7.3.12令和7年第1回定例会(2日目)　会議録</a>（4.5MB）</p>
        </div>
      </div>
    `;

    const links = parseYearPage(html, PAGE_URL);

    expect(links).toHaveLength(2);
    expect(links[0]!.session).toBe("令和７年第１回定例会 会議録");
    expect(links[0]!.text).toBe("R7.3.5令和7年第1回定例会(1日目) 会議録");
    expect(links[0]!.pdfUrl).toBe(
      "http://www.town.toyo.kochi.jp/gikai-toyo/pbfile/m000263/pbf20250610133721_DBhHU3xbElHe.pdf"
    );
    expect(links[1]!.text).toBe("R7.3.12令和7年第1回定例会(2日目) 会議録");
  });

  it("複数の定例会と臨時会から PDF リンクを抽出する", () => {
    const html = `
      <div id="pb_main">
        <div>
          <h3>令和７年第１回定例会　会議録</h3>
          <p class="pb_file"><a href="pbfile/m000263/pbf001.pdf">R7.3.5令和7年第1回定例会(1日目)　会議録</a></p>
          <h3>令和７年第１回臨時会　会議録</h3>
          <p class="pb_file"><a href="pbfile/m000263/pbf002.pdf">R7.6.10令和7年第1回臨時会　会議録</a></p>
        </div>
      </div>
    `;

    const links = parseYearPage(html, PAGE_URL);

    expect(links).toHaveLength(2);
    expect(links[0]!.session).toBe("令和７年第１回定例会 会議録");
    expect(links[1]!.session).toBe("令和７年第１回臨時会 会議録");
  });

  it("旧形式（平成）の PDF リンクを抽出する", () => {
    const html = `
      <div id="pb_main">
        <div>
          <h3>平成25年　会議録</h3>
          <p class="pb_file"><a href="pbfile/m000007/h251205teirei-1.pdf">平成25年12月5日会議録</a></p>
        </div>
      </div>
    `;

    const links = parseYearPage(html, PAGE_URL);

    expect(links).toHaveLength(1);
    expect(links[0]!.text).toBe("平成25年12月5日会議録");
  });

  it("div#pb_main がない場合は空配列を返す", () => {
    const html = `<div><p>コンテンツなし</p></div>`;
    const links = parseYearPage(html, PAGE_URL);
    expect(links).toHaveLength(0);
  });

  it("PDF リンクが0件の場合は空配列を返す", () => {
    const html = `
      <div id="pb_main">
        <div>
          <h3>令和7年第1回定例会</h3>
        </div>
      </div>
    `;
    const links = parseYearPage(html, PAGE_URL);
    expect(links).toHaveLength(0);
  });

  it("絶対パスの PDF URL を正しく構築する", () => {
    const html = `
      <div id="pb_main">
        <div>
          <h3>令和7年第1回定例会</h3>
          <p class="pb_file"><a href="/gikai-toyo/pbfile/m000263/pbf001.pdf">R7.3.5令和7年第1回定例会(1日目)　会議録</a></p>
        </div>
      </div>
    `;

    const links = parseYearPage(html, PAGE_URL);

    expect(links).toHaveLength(1);
    expect(links[0]!.pdfUrl).toBe(
      "http://www.town.toyo.kochi.jp/gikai-toyo/pbfile/m000263/pbf001.pdf"
    );
  });
});
