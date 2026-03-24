import { describe, expect, it } from "vitest";
import { parseDateFromLinkText, parseListPage } from "./list";

describe("parseDateFromLinkText", () => {
  it("本会議リンクテキストから日付を抽出する", () => {
    expect(
      parseDateFromLinkText("令和6年第4回定例会3日目（令和6年12月24日）")
    ).toBe("2024-12-24");
  });

  it("委員会リンクテキストから日付を抽出する", () => {
    expect(parseDateFromLinkText("令和6年12月11日　総務文教委員会")).toBe(
      "2024-12-11"
    );
  });

  it("月・日が1桁でもゼロパディングされる", () => {
    expect(parseDateFromLinkText("令和6年第1回定例会1日目（令和6年3月5日）")).toBe(
      "2024-03-05"
    );
  });

  it("平成年号を正しく変換する", () => {
    expect(parseDateFromLinkText("平成30年3月7日　定例会")).toBe("2018-03-07");
  });

  it("令和元年を正しく変換する", () => {
    expect(parseDateFromLinkText("令和元年5月1日　臨時会")).toBe("2019-05-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromLinkText("会議録")).toBeNull();
  });
});

describe("parseListPage", () => {
  it("h3 見出しと PDF リンクを正しく抽出する", () => {
    const html = `
      <h3>本会議</h3>
      <ul>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf">令和6年第4回定例会3日目（令和6年12月24日）</a></li>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061204tei2.pdf">令和6年第4回定例会2日目（令和6年12月4日）</a></li>
      </ul>
      <h3>常任委員会</h3>
      <ul>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061211soumu.pdf">令和6年12月11日　総務文教委員会</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(3);

    expect(meetings[0]!.section).toBe("本会議");
    expect(meetings[0]!.title).toBe("令和6年第4回定例会3日目（令和6年12月24日）");
    expect(meetings[0]!.heldOn).toBe("2024-12-24");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf"
    );

    expect(meetings[1]!.section).toBe("本会議");
    expect(meetings[1]!.title).toBe("令和6年第4回定例会2日目（令和6年12月4日）");
    expect(meetings[1]!.heldOn).toBe("2024-12-04");

    expect(meetings[2]!.section).toBe("常任委員会");
    expect(meetings[2]!.title).toBe("令和6年12月11日　総務文教委員会");
    expect(meetings[2]!.heldOn).toBe("2024-12-11");
  });

  it("プロトコル相対 URL を正しく絶対 URL に変換する", () => {
    const html = `
      <h3>本会議</h3>
      <ul>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf">令和6年第4回定例会3日目（令和6年12月24日）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf"
    );
  });

  it("/material/files/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <h3>本会議</h3>
      <ul>
        <li><a href="/other/path/document.pdf">別の文書</a></li>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf">令和6年第4回定例会3日目（令和6年12月24日）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf"
    );
  });

  it("日付が取得できない PDF は heldOn が null になる", () => {
    const html = `
      <h3>本会議</h3>
      <ul>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/somefile.pdf">会議録</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBeNull();
  });

  it("空の HTML は空配列を返す", () => {
    const meetings = parseListPage("");
    expect(meetings).toHaveLength(0);
  });

  it("臨時会のリンクも抽出する", () => {
    const html = `
      <h3>本会議</h3>
      <ul>
        <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r060508rinji.pdf">令和6年第2回臨時会（令和6年5月8日）</a></li>
      </ul>
    `;

    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-05-08");
    expect(meetings[0]!.section).toBe("本会議");
  });
});
