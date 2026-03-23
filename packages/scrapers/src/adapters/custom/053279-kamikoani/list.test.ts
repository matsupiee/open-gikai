import { describe, it, expect } from "vitest";
import { parseListPage } from "./list";
import { parseHeldOn, getEraYears } from "./shared";

describe("parseListPage", () => {
  it("定例会の PDF リンクを正しく抽出する", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th" style="text-align: center" width="250">
            <div>&nbsp;</div>
            <div>令和７年第８回定例会</div>
            <div>（令和７年１２月９日～１１日）</div>
            <div>&nbsp;</div>
          </th>
          <td class="editor_td" style="text-align: center" width="150">
            <div style="text-align: left;"><a href="https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R7-8-1.pdf">①開会～行政報告</a></div>
            <div style="text-align: left;"><a href="https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R7-8-2.pdf">②一般質問（長井直人議員）</a></div>
            <div style="text-align: left;"><a href="https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R7-8-3.pdf">③一般質問（萩野芳紀議員）</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);

    expect(pdfs).toHaveLength(3);
    expect(pdfs[0]!.meetingTitle).toBe("令和７年第８回定例会");
    expect(pdfs[0]!.partTitle).toBe("①開会～行政報告");
    expect(pdfs[0]!.heldOn).toBe("2025-12-09");
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R7-8-1.pdf"
    );
    expect(pdfs[1]!.partTitle).toBe("②一般質問（長井直人議員）");
    expect(pdfs[2]!.partTitle).toBe("③一般質問（萩野芳紀議員）");
  });

  it("臨時会の PDF リンクを正しく抽出する", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th" style="text-align: center" width="250">
            <div>&nbsp;</div>
            <div>令和８年第１回臨時会</div>
            <div>（令和８年２月12日）</div>
            <div>&nbsp;</div>
          </th>
          <td class="editor_td" style="text-align: center" width="250">
            <div style="text-align: left;"><a href="https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R8-1-1.pdf">①開会～閉会</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.meetingTitle).toBe("令和８年第１回臨時会");
    expect(pdfs[0]!.heldOn).toBe("2026-02-12");
    expect(pdfs[0]!.partTitle).toBe("①開会～閉会");
  });

  it("相対パスの href を絶対 URL に変換する", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th">
            <div>令和６年第１回定例会</div>
            <div>（令和６年３月５日）</div>
          </th>
          <td class="editor_td">
            <div><a href="/div/gikai/pdf/gikai/R6-1-1.pdf">①開会～行政報告</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R6-1-1.pdf"
    );
  });

  it("dload パスの href も絶対 URL に変換する", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th">
            <div>平成27年第１回定例会</div>
            <div>（平成27年3月5日）</div>
          </th>
          <td class="editor_td">
            <div><a href="/div/gikai/dload/gikai/H27-3/H27-3-f.pdf">⑥開議～閉会</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.pdfUrl).toBe(
      "https://www.vill.kamikoani.akita.jp/div/gikai/dload/gikai/H27-3/H27-3-f.pdf"
    );
  });

  it("複数の会議が含まれる場合に全件抽出する", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th">
            <div>令和７年第８回定例会</div>
            <div>（令和７年１２月９日～１１日）</div>
          </th>
          <td class="editor_td">
            <div><a href="https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R7-8-1.pdf">①開会～行政報告</a></div>
          </td>
        </tr>
        <tr>
          <th class="editor_th">
            <div>令和７年第７回臨時会</div>
            <div>（令和７年１０月２７日）</div>
          </th>
          <td class="editor_td">
            <div><a href="https://www.vill.kamikoani.akita.jp/div/gikai/pdf/gikai/R7-7-1.pdf">①開会～閉会</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);

    expect(pdfs).toHaveLength(2);
    expect(pdfs[0]!.meetingTitle).toBe("令和７年第８回定例会");
    expect(pdfs[1]!.meetingTitle).toBe("令和７年第７回臨時会");
  });

  it("PDF リンクがない行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th">
            <div>令和７年第４回臨時会</div>
            <div>（令和７年５月１日）</div>
          </th>
          <td class="editor_td">
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);
    expect(pdfs).toHaveLength(0);
  });

  it("開催日のパースに失敗した行はスキップする", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th">
            <div>令和７年第８回定例会</div>
            <div>（日付なし）</div>
          </th>
          <td class="editor_td">
            <div><a href="/div/gikai/pdf/gikai/R7-8-1.pdf">①開会～行政報告</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);
    expect(pdfs).toHaveLength(0);
  });

  it("平成の会議録を正しく抽出する", () => {
    const html = `
      <table>
        <tr>
          <th class="editor_th">
            <div>平成30年第１回定例会</div>
            <div>（平成30年3月5日）</div>
          </th>
          <td class="editor_td">
            <div><a href="/div/gikai/pdf/gikai/H30-3/30-3-a.pdf">①開会～施政方針・行政報告</a></div>
          </td>
        </tr>
      </table>
    `;

    const pdfs = parseListPage(html);

    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]!.meetingTitle).toBe("平成30年第１回定例会");
    expect(pdfs[0]!.heldOn).toBe("2018-03-05");
  });
});

describe("parseHeldOn", () => {
  it("令和の全角日付をパースする", () => {
    expect(parseHeldOn("令和７年１２月９日～１１日")).toBe("2025-12-09");
  });

  it("令和の半角日付をパースする", () => {
    expect(parseHeldOn("令和8年2月12日")).toBe("2026-02-12");
  });

  it("平成の日付をパースする", () => {
    expect(parseHeldOn("平成30年3月5日")).toBe("2018-03-05");
  });

  it("令和元年をパースする", () => {
    expect(parseHeldOn("令和元年５月７日")).toBe("2019-05-07");
  });

  it("日付がないテキストは null を返す", () => {
    expect(parseHeldOn("日付なし")).toBeNull();
  });
});

describe("getEraYears", () => {
  it("令和の年度に対応するテキストを返す", () => {
    const years = getEraYears(2025);
    expect(years).toContain("令和7年");
  });

  it("平成の年度に対応するテキストを返す", () => {
    const years = getEraYears(2018);
    expect(years).toContain("平成30年");
  });

  it("令和元年（2019年）に対応するテキストを返す", () => {
    const years = getEraYears(2019);
    expect(years).toContain("令和元年");
    expect(years).toContain("令和1年");
  });
});
