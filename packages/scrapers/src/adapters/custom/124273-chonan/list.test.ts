import { describe, it, expect } from "vitest";
import { parseTopPage, parseYearPage, parseDateText, parseLinkText } from "./list";

describe("parseTopPage", () => {
  it("年度別ページのリンクを抽出する", () => {
    const html = `
      <ul>
        <li><a href="https://www.town.chonan.chiba.jp/chousei/gikai/%e4%bc%9a%e8%ad%b0%e9%8c%b2/46552/">令和７年 会議録</a></li>
        <li><a href="https://www.town.chonan.chiba.jp/chousei/gikai/%e4%bc%9a%e8%ad%b0%e9%8c%b2/41773/">令和６年 会議録</a></li>
        <li><a href="https://www.town.chonan.chiba.jp/chousei/gikai/%e4%bc%9a%e8%ad%b0%e9%8c%b2/36406/">令和５年 会議録</a></li>
      </ul>
    `;

    const pages = parseTopPage(html);

    expect(pages).toHaveLength(3);
    expect(pages[0]!.label).toBe("令和７年 会議録");
    expect(pages[0]!.url).toBe(
      "https://www.town.chonan.chiba.jp/chousei/gikai/%e4%bc%9a%e8%ad%b0%e9%8c%b2/46552/"
    );
    expect(pages[1]!.label).toBe("令和６年 会議録");
    expect(pages[2]!.label).toBe("令和５年 会議録");
  });

  it("会議録を含まないリンクはスキップする", () => {
    const html = `
      <a href="/chousei/gikai/about/">議会について</a>
      <a href="https://www.town.chonan.chiba.jp/chousei/gikai/%e4%bc%9a%e8%ad%b0%e9%8c%b2/46552/">令和７年 会議録</a>
    `;

    const pages = parseTopPage(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.label).toBe("令和７年 会議録");
  });
});

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("令和6年12月3日")).toBe("2024-12-03");
  });

  it("全角数字の日付をパースする", () => {
    expect(parseDateText("令和６年１２月３日")).toBe("2024-12-03");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成30年3月5日")).toBe("2018-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("目次")).toBeNull();
  });
});

describe("parseLinkText", () => {
  it("定例会リンクテキストをパースする", () => {
    const result = parseLinkText("令和６年第４回定例会第１号　12月3日");

    expect(result).not.toBeNull();
    expect(result!.section).toBe("令和6年第4回定例会");
    expect(result!.issueNumber).toBe("1");
    expect(result!.month).toBe(12);
    expect(result!.day).toBe(3);
  });

  it("臨時会リンクテキストをパースする", () => {
    const result = parseLinkText("令和６年第１回臨時会第１号　５月１５日");

    expect(result).not.toBeNull();
    expect(result!.section).toBe("令和6年第1回臨時会");
    expect(result!.issueNumber).toBe("1");
    expect(result!.month).toBe(5);
    expect(result!.day).toBe(15);
  });

  it("目次はパースしない", () => {
    expect(parseLinkText("目次")).toBeNull();
  });
});

describe("parseYearPage", () => {

  it("セクション見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>令和６年第４回定例会</h3>
      <a href="https://www.town.chonan.chiba.jp/wp-content/uploads/2024/12/224b98a818d36bb531f41fe698892755.pdf">目次</a>
      <a href="https://www.town.chonan.chiba.jp/wp-content/uploads/2024/12/332c7593c8180c84dbc4c418f029455d.pdf">令和６年第４回定例会第１号　12月3日</a>
      <a href="https://www.town.chonan.chiba.jp/wp-content/uploads/2024/12/abc123def456.pdf">令和６年第４回定例会第２号　12月6日</a>
      <h3>令和６年第３回定例会</h3>
      <a href="https://www.town.chonan.chiba.jp/wp-content/uploads/2024/09/aaa111.pdf">目次</a>
      <a href="https://www.town.chonan.chiba.jp/wp-content/uploads/2024/09/bbb222.pdf">令和６年第３回定例会第１号　9月3日</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.section).toBe("令和6年第4回定例会");
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
    expect(meetings[0]!.title).toBe("令和6年第4回定例会第1号");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.chonan.chiba.jp/wp-content/uploads/2024/12/332c7593c8180c84dbc4c418f029455d.pdf"
    );

    expect(meetings[1]!.section).toBe("令和6年第4回定例会");
    expect(meetings[1]!.heldOn).toBe("2024-12-06");
    expect(meetings[1]!.title).toBe("令和6年第4回定例会第2号");

    expect(meetings[2]!.section).toBe("令和6年第3回定例会");
    expect(meetings[2]!.heldOn).toBe("2024-09-03");
  });

  it("目次リンクはスキップする", () => {
    const html = `
      <h3>令和６年第４回定例会</h3>
      <a href="https://example.com/toc.pdf">目次</a>
      <a href="https://example.com/content.pdf">令和６年第４回定例会第１号　12月3日</a>
    `;

    const meetings = parseYearPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("令和6年第4回定例会第1号");
  });

  it("臨時会セクションも正しく抽出する", () => {
    const html = `
      <h3>令和６年第１回臨時会</h3>
      <a href="https://example.com/rinji.pdf">令和６年第１回臨時会第１号　5月15日</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("令和6年第1回臨時会");
  });

  it("全角数字のリンクテキストも正しく処理する", () => {
    const html = `
      <h3>令和６年第４回定例会</h3>
      <a href="https://example.com/doc.pdf">令和６年第４回定例会第１号　１２月３日</a>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-12-03");
  });
});
