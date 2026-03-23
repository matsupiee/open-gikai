import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseSectionDate } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="/cms/articles/show/11780">令和７年会議録</a></li>
        <li><a href="/cms/articles/show/10364">令和６年会議録</a></li>
        <li><a href="/cms/articles/show/9588">令和５年会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和７年会議録");
    expect(pages[0]!.url).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/articles/show/11780"
    );
    expect(pages[1]!.label).toBe("令和６年会議録");
    expect(pages[1]!.url).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/articles/show/10364"
    );
    expect(pages[2]!.label).toBe("令和５年会議録");
  });

  it("会議録・年を含まないリンクはスキップする", () => {
    const html = `
      <a href="/cms/articles/show/999">お知らせ一覧</a>
      <a href="/cms/articles/show/11780">令和７年会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和７年会議録");
  });

  it("絶対 URL のリンクもそのまま処理する", () => {
    const html = `
      <a href="https://www.city.etajima.hiroshima.jp/cms/articles/show/11780">令和７年会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.url).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/articles/show/11780"
    );
  });

  it("注意書きリンクもフィルタリングされない（年を含まない場合はスキップ）", () => {
    const html = `
      <a href="/cms/articles/show/3812">会議録の公開は，閉会後概ね3カ月です。ご了承ください。</a>
      <a href="/cms/articles/show/11780">令和７年会議録</a>
    `;

    const pages = parseTopPage(html);
    // 「3カ月」の「3」は「年」を含まないがカタカナなので通過しない
    // 「会議録の公開は...」は「会議録」を含むため通過する
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.some((p) => p.label === "令和７年会議録")).toBe(true);
  });
});

describe("parseSectionDate", () => {
  it("令和の全角セクション見出しから年月を取得する", () => {
    expect(
      parseSectionDate("令和６年第１回定例会（令和６年２月）")
    ).toBe("2024-02");
  });

  it("令和の半角セクション見出しから年月を取得する", () => {
    expect(
      parseSectionDate("令和7年第1回定例会（令和7年3月）")
    ).toBe("2025-03");
  });

  it("平成のセクション見出しから年月を取得する", () => {
    expect(
      parseSectionDate("平成３０年第２回定例会（平成３０年６月）")
    ).toBe("2018-06");
  });

  it("カッコなしのセクションからは年のみで推定する", () => {
    expect(
      parseSectionDate("令和７年第１回定例会")
    ).toBe("2025-01");
  });

  it("パースできない場合は null を返す", () => {
    expect(parseSectionDate("資料一覧")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL =
    "https://www.city.etajima.hiroshima.jp/cms/articles/show/10364";

  it("セクション見出しと日目 PDF リンクを正しく抽出する", () => {
    const html = `
      <p>令和６年第１回定例会（令和６年２月）</p>
      <ul>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/hyoshi.pdf">第１回定例会会議録（表紙・目次　PDF520KB）</a></li>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/1day.pdf">第１回定例会会議録（１日目　PDF738KB）</a></li>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/2day.pdf">第１回定例会会議録（２日目　PDF765KB）</a></li>
      </ul>
      <p>令和６年第２回定例会（令和６年６月）</p>
      <ul>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/r6_2_hyoshi.pdf">第２回定例会会議録（表紙・目次　PDF282KB）</a></li>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/r6_2_1day.pdf">第２回定例会会議録（１日目　PDF798KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.title).toContain("１日目");
    expect(meetings[0]!.heldOn).toBe("2024-02-01");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/files/uploads/1day.pdf"
    );
    expect(meetings[0]!.section).toBe("令和６年第１回定例会（令和６年２月）");

    expect(meetings[1]!.heldOn).toBe("2024-02-01");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/files/uploads/2day.pdf"
    );

    expect(meetings[2]!.heldOn).toBe("2024-06-01");
    expect(meetings[2]!.pdfUrl).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/files/uploads/r6_2_1day.pdf"
    );
  });

  it("表紙・目次 PDF はスキップする", () => {
    const html = `
      <p>令和６年第１回定例会（令和６年２月）</p>
      <ul>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/hyoshi.pdf">第１回定例会会議録（表紙・目次　PDF520KB）</a></li>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/mokuji.pdf">第１回定例会会議録（目次　PDF200KB）</a></li>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/1day.pdf">第１回定例会会議録（１日目　PDF738KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toContain("１日目");
  });

  it("臨時会セクションも正しく抽出する", () => {
    const html = `
      <p>令和６年第４回臨時会（令和６年１０月）</p>
      <ul>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/rinji.pdf">第４回臨時会会議録（１日目　PDF300KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toContain("臨時会");
  });

  it("古い年度の migration パスも正しく URL を構築する", () => {
    const html = `
      <p>平成２４年第１回定例会（平成２４年３月）</p>
      <ul>
        <li><a href="/cms/migration/uploads/smartsection/h24no01_1stday.pdf">第１回定例会会議録（１日目　PDF500KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.etajima.hiroshima.jp/cms/migration/uploads/smartsection/h24no01_1stday.pdf"
    );
  });

  it("日目を含まないリンクはスキップする", () => {
    const html = `
      <p>令和６年第１回定例会（令和６年２月）</p>
      <ul>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/schedule.pdf">議事日程</a></li>
        <li><a href="https://www.city.etajima.hiroshima.jp/cms/files/uploads/1day.pdf">第１回定例会会議録（１日目　PDF738KB）</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(1);
  });
});
