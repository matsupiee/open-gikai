import { describe, it, expect } from "vitest";
import { parseIndexPage, parseDateFromTitle, parseArticlePdfLinks } from "./list";

describe("parseDateFromTitle", () => {
  it("カッコ内の単日の開催日をパースする", () => {
    expect(
      parseDateFromTitle("第142回臨時会（令和8年1月30日）"),
    ).toBe("2026-01-30");
  });

  it("カッコ内の複数日は初日を返す", () => {
    expect(
      parseDateFromTitle(
        "令和8年3月第143回定例会（令和8年3月6日～13日）",
      ),
    ).toBe("2026-03-06");
  });

  it("令和7年12月のカッコ内日付をパースする", () => {
    expect(
      parseDateFromTitle(
        "令和7年12月第141回定例会（令和7年12月5日～9日）",
      ),
    ).toBe("2025-12-05");
  });

  it("カッコがない場合はタイトル先頭の年月から推定する", () => {
    expect(
      parseDateFromTitle("令和7年9月深浦町議会第140回定例会"),
    ).toBe("2025-09-01");
  });

  it("全角数字を含むタイトルをパースする", () => {
    expect(
      parseDateFromTitle("令和８年１月第142回臨時会（令和８年１月30日）"),
    ).toBe("2026-01-30");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromTitle("定例会・臨時会")).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("指定年度のリンクのみ抽出する", () => {
    const html = `
      <h2>令和７年度</h2>
      <ul>
        <li><a href="/doc/2026031800110/">令和8年3月第143回定例会（令和8年3月6日～13日）</a></li>
        <li><a href="/doc/2026012600012/">令和８年１月第142回臨時会（令和8年1月30日）</a></li>
      </ul>
      <h2>令和６年度</h2>
      <ul>
        <li><a href="/doc/2025021800017/">第137回定例会（令和7年3月7日～14日）</a></li>
      </ul>
    `;

    const entries = parseIndexPage(html, 2025);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.title).toBe(
      "令和8年3月第143回定例会（令和8年3月6日～13日）",
    );
    expect(entries[0]!.heldOn).toBe("2026-03-06");
    expect(entries[0]!.docId).toBe("2026031800110");
    expect(entries[0]!.articleUrl).toBe(
      "https://www.town.fukaura.lg.jp/doc/2026031800110/",
    );

    expect(entries[1]!.title).toBe(
      "令和８年１月第142回臨時会（令和8年1月30日）",
    );
    expect(entries[1]!.heldOn).toBe("2026-01-30");
  });

  it("令和6年度を指定すると令和6年度セクションのみ返す", () => {
    const html = `
      <h2>令和７年度</h2>
      <ul>
        <li><a href="/doc/2026031800110/">令和8年3月第143回定例会（令和8年3月6日～13日）</a></li>
      </ul>
      <h2>令和６年度</h2>
      <ul>
        <li><a href="/doc/2025021800017/">第137回定例会（令和7年3月7日～14日）</a></li>
        <li><a href="/doc/2024112600017/">第135回定例会（令和6年12月6日～10日）</a></li>
      </ul>
    `;

    const entries = parseIndexPage(html, 2024);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.heldOn).toBe("2025-03-07");
    expect(entries[1]!.heldOn).toBe("2024-12-06");
  });

  it("該当年度がない場合は空配列を返す", () => {
    const html = `
      <h2>令和７年度</h2>
      <ul>
        <li><a href="/doc/2026031800110/">令和8年3月第143回定例会（令和8年3月6日～13日）</a></li>
      </ul>
    `;

    const entries = parseIndexPage(html, 2020);
    expect(entries).toHaveLength(0);
  });

  it("doc ID を含まないリンクはスキップする", () => {
    const html = `
      <h2>令和７年度</h2>
      <ul>
        <li><a href="/category/bunya/gikai/">議会トップ</a></li>
        <li><a href="/doc/2026031800110/">令和8年3月第143回定例会（令和8年3月6日～13日）</a></li>
      </ul>
    `;

    const entries = parseIndexPage(html, 2025);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.docId).toBe("2026031800110");
  });
});

describe("parseArticlePdfLinks", () => {
  it("議員名付き一般質問 PDF のみ抽出する", () => {
    const html = `
      <h2>採決結果</h2>
      <p><a href="file_contents/file_202512103163430_1.pdf">令和7年12月定例会議案等採決結果 [PDF：101KB]</a></p>
      <h2>一般質問</h2>
      <p><a href="file_contents/file_20262135112435_1.pdf">一般質問わが町のここが聞きたい（７ページ）[PDF：709KB]</a></p>
      <p><a href="file_contents/file_2026213511255_1.pdf">岩谷司議員「令和８年度予算」（８ページから９ページ）[PDF：950KB]</a></p>
      <p><a href="file_contents/file_20262135112514_1.pdf">七戸仁議員「十二湖駅」（10ページ）[PDF：807KB]</a></p>
    `;

    const urls = parseArticlePdfLinks(
      html,
      "https://www.town.fukaura.lg.jp/doc/2025112700042/",
    );

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(
      "https://www.town.fukaura.lg.jp/doc/2025112700042/file_contents/file_2026213511255_1.pdf",
    );
    expect(urls[1]).toBe(
      "https://www.town.fukaura.lg.jp/doc/2025112700042/file_contents/file_20262135112514_1.pdf",
    );
  });

  it("採決結果 PDF は除外する", () => {
    const html = `
      <p><a href="file_contents/result.pdf">議案等採決結果 [PDF：100KB]</a></p>
    `;

    const urls = parseArticlePdfLinks(
      html,
      "https://www.town.fukaura.lg.jp/doc/2025112700042/",
    );

    expect(urls).toHaveLength(0);
  });

  it("概要 PDF は除外する", () => {
    const html = `
      <p><a href="file_contents/overview.pdf">一般質問わが町のここが聞きたい（５ページ）[PDF：709KB]</a></p>
    `;

    const urls = parseArticlePdfLinks(
      html,
      "https://www.town.fukaura.lg.jp/doc/2025112700042/",
    );

    expect(urls).toHaveLength(0);
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `<h2>会期日程</h2><table><tr><td>第１日目</td></tr></table>`;

    const urls = parseArticlePdfLinks(
      html,
      "https://www.town.fukaura.lg.jp/doc/2025112700042/",
    );

    expect(urls).toHaveLength(0);
  });
});
