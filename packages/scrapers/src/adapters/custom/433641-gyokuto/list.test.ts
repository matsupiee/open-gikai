import { describe, expect, it } from "vitest";
import { parseDateLabel, parseTopPage, parseYearPage } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <div class="loadbox"><ul>
        <li><span>2026年1月29日更新</span>
          <a href="https://www.town.gyokuto.kumamoto.jp/kiji0031559/index.html">令和7年玉東町議会会議録</a></li>
        <li><span>2025年1月31日更新</span>
          <a href="https://www.town.gyokuto.kumamoto.jp/kiji0031376/index.html">令和6年玉東町議会会議録</a></li>
        <li><span>2024年1月31日更新</span>
          <a href="https://www.town.gyokuto.kumamoto.jp/kiji0031229/index.html">令和5年玉東町議会会議録</a></li>
      </ul></div>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和7年玉東町議会会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.gyokuto.kumamoto.jp/kiji0031559/index.html",
    );
    expect(pages[1]!.label).toBe("令和6年玉東町議会会議録");
    expect(pages[2]!.label).toBe("令和5年玉東町議会会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="https://www.town.gyokuto.kumamoto.jp/kiji0031000/index.html">お知らせ</a>
      <a href="https://www.town.gyokuto.kumamoto.jp/kiji0031559/index.html">令和7年玉東町議会会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和7年玉東町議会会議録");
  });

  it("相対 URL を絶対 URL に変換する", () => {
    const html = `
      <a href="/kiji0031559/index.html">令和7年玉東町議会会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toBe(
      "https://www.town.gyokuto.kumamoto.jp/kiji0031559/index.html",
    );
  });
});

describe("parseDateLabel", () => {
  it("月日をパースして YYYY-MM-DD を返す", () => {
    expect(parseDateLabel("3月6日（PDF：888.2キロバイト）", 2024, "第1回(3月)定例会")).toBe(
      "2024-03-06",
    );
  });

  it("2桁の月日を扱う", () => {
    expect(parseDateLabel("12月11日（PDF：688.2キロバイト）", 2024, "第4回(12月)定例会")).toBe(
      "2024-12-11",
    );
  });

  it("日付がないテキストは null を返す", () => {
    expect(parseDateLabel("目次（PDF：58.4キロバイト）", 2024, "")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.town.gyokuto.kumamoto.jp/kiji0031376/index.html";

  it("h4 セクション見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h4>第1回(1月)臨時会</h4>
      <ul>
        <li><a href="https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3086_up_zierquwd.pdf"><img src="pdf.gif" alt="">目次（PDF：58.4キロバイト）<img src="newwin.gif" alt="別ウインドウで開きます"></a></li>
        <li><a href="https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3087_up_hp2b0vdg.pdf"><img src="pdf.gif" alt="">1月17日（PDF：422キロバイト）<img src="newwin.gif" alt="別ウインドウで開きます"></a></li>
      </ul>
      <h4>第1回(3月)定例会</h4>
      <ul>
        <li><a href="https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3152_up_rnlrcuwv.pdf"><img src="pdf.gif" alt="">目次（PDF：159.9キロバイト）<img src="newwin.gif" alt="別ウインドウで開きます"></a></li>
        <li><a href="https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3207_up_x3jk76b7.pdf"><img src="pdf.gif" alt="">3月6日（PDF：888.2キロバイト）<img src="newwin.gif" alt="別ウインドウで開きます"></a></li>
        <li><a href="https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3208_up_85kjey80.pdf"><img src="pdf.gif" alt="">3月7日（PDF：700キロバイト）<img src="newwin.gif" alt="別ウインドウで開きます"></a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);

    expect(meetings).toHaveLength(3);

    // 臨時会
    expect(meetings[0]!.section).toBe("第1回(1月)臨時会");
    expect(meetings[0]!.heldOn).toBe("2024-01-17");
    expect(meetings[0]!.title).toBe("第1回(1月)臨時会 1月17日");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3087_up_hp2b0vdg.pdf",
    );

    // 定例会
    expect(meetings[1]!.section).toBe("第1回(3月)定例会");
    expect(meetings[1]!.heldOn).toBe("2024-03-06");

    expect(meetings[2]!.section).toBe("第1回(3月)定例会");
    expect(meetings[2]!.heldOn).toBe("2024-03-07");
  });

  it("目次 PDF はスキップする", () => {
    const html = `
      <h4>第1回(1月)臨時会</h4>
      <ul>
        <li><a href="https://example.com/toc.pdf"><img src="pdf.gif">目次（PDF：58.4キロバイト）</a></li>
        <li><a href="https://example.com/body.pdf"><img src="pdf.gif">1月17日（PDF：422キロバイト）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-01-17");
  });

  it("日付を含まないリンクはスキップする", () => {
    const html = `
      <h4>第1回(3月)定例会</h4>
      <ul>
        <li><a href="https://example.com/body.pdf"><img src="pdf.gif">3月6日（PDF：888.2キロバイト）</a></li>
        <li><a href="https://example.com/other.pdf"><img src="pdf.gif">参考資料</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);
    expect(meetings).toHaveLength(1);
  });

  it("相対 href を絶対 URL に変換する", () => {
    const html = `
      <h4>第1回(3月)定例会</h4>
      <ul>
        <li><a href="./3_1376_3207_up_x3jk76b7.pdf"><img src="pdf.gif">3月6日（PDF：888.2キロバイト）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.gyokuto.kumamoto.jp/kiji0031376/3_1376_3207_up_x3jk76b7.pdf",
    );
  });
});
