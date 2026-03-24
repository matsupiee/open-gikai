import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";
import { parseDateText } from "./shared";

describe("parseDateText", () => {
  it("全角数字の発行日を YYYY-MM-DD に変換する", () => {
    const result = parseDateText("（２月３日発行）", "2025年");
    expect(result).toBe("2025-02-03");
  });

  it("半角数字の発行日を YYYY-MM-DD に変換する", () => {
    const result = parseDateText("（11月22日発行）", "2024年");
    expect(result).toBe("2024-11-22");
  });

  it("年が取得できない場合は null を返す", () => {
    const result = parseDateText("（２月３日発行）", "不明");
    expect(result).toBeNull();
  });

  it("月日が取得できない場合は null を返す", () => {
    const result = parseDateText("発行日不明", "2025年");
    expect(result).toBeNull();
  });

  it("全角括弧を含む発行日を正しくパースする", () => {
    const result = parseDateText("（８月１日発行）", "2023年");
    expect(result).toBe("2023-08-01");
  });
});

describe("parseListPage", () => {
  it("h2 と table から議会だより一覧を取得する", () => {
    const html = `
      <h2>2025年</h2>
      <table cellpadding="1" cellspacing="1">
        <tbody>
          <tr>
            <td>
              <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank">222号</a></p>
              <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank">（２月３日発行）</a></p>
              <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank"><img alt="222" height="112" src="images/gikai222.jpg" width="80"></a></p>
              <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank"><span class="wcv_ww_filesize">(1760KB)</span></a></p>
            </td>
            <td>
              <p style="text-align: center;"><a href="files/gikai221.pdf" target="_blank">221号</a></p>
              <p style="text-align: center;"><a href="files/gikai221.pdf" target="_blank">（11月22日発行）</a></p>
              <p style="text-align: center;"><a href="files/gikai221.pdf" target="_blank"><img alt="221" height="112" src="images/gikai221.jpg" width="80"></a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.issue).toBe("222号");
    expect(docs[0]!.heldOn).toBe("2025-02-03");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.imabetsu.lg.jp/gyousei/gikai/files/gikai222.pdf",
    );
    expect(docs[0]!.year).toBe("2025年");
    expect(docs[1]!.issue).toBe("221号");
    expect(docs[1]!.heldOn).toBe("2025-11-22");
  });

  it("複数の年を正しく処理する", () => {
    const html = `
      <h2>2025年</h2>
      <table>
        <tbody><tr>
          <td>
            <p><a href="files/gikai222.pdf">222号</a></p>
            <p><a href="files/gikai222.pdf">（２月３日発行）</a></p>
          </td>
        </tr></tbody>
      </table>
      <h2>2024年</h2>
      <table>
        <tbody><tr>
          <td>
            <p><a href="files/gikai218.pdf">218号</a></p>
            <p><a href="files/gikai218.pdf">（11月15日発行）</a></p>
          </td>
        </tr></tbody>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(2);
    expect(docs[0]!.year).toBe("2025年");
    expect(docs[0]!.issue).toBe("222号");
    expect(docs[1]!.year).toBe("2024年");
    expect(docs[1]!.issue).toBe("218号");
    expect(docs[1]!.heldOn).toBe("2024-11-15");
  });

  it("PDF リンクがない td（空セル）はスキップする", () => {
    const html = `
      <h2>2025年</h2>
      <table>
        <tbody><tr>
          <td>&nbsp;</td>
          <td>
            <p><a href="files/gikai222.pdf">222号</a></p>
            <p><a href="files/gikai222.pdf">（２月３日発行）</a></p>
          </td>
        </tr></tbody>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.issue).toBe("222号");
  });

  it("発行日が解析できない場合は heldOn が null", () => {
    const html = `
      <h2>2025年</h2>
      <table>
        <tbody><tr>
          <td>
            <p><a href="files/gikai222.pdf">222号</a></p>
          </td>
        </tr></tbody>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.heldOn).toBeNull();
  });

  it("古い号のファイル名パターン（番号のみ）も取得できる", () => {
    const html = `
      <h2>2010年</h2>
      <table>
        <tbody><tr>
          <td>
            <p><a href="files/0183.pdf">183号</a></p>
            <p><a href="files/0183.pdf">（２月１日発行）</a></p>
          </td>
        </tr></tbody>
      </table>
    `;

    const docs = parseListPage(html);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.issue).toBe("183号");
    expect(docs[0]!.pdfUrl).toBe(
      "https://www.town.imabetsu.lg.jp/gyousei/gikai/files/0183.pdf",
    );
  });

  it("HTML が空の場合は空配列を返す", () => {
    const docs = parseListPage("<html><body></body></html>");
    expect(docs).toHaveLength(0);
  });
});
