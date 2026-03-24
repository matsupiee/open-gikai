import { describe, expect, it } from "vitest";
import { parseListPage } from "./list";

describe("parseListPage", () => {
  it("年度と PDF リンクからメタ情報を抽出する", () => {
    const html = `
      <h3>令和7年</h3>
      <table style="width: 100%;" align="center">
        <tr><td>
          <p>第3回定例会（<a href="assets/files/pdf/gikai/R07dai3kaiteireikaikaigiroku.pdf">PDF</a>）</p>
          <p>第4回臨時会（<a href="assets/files/pdf/gikai/R7dai4kairinjikaikaigiroku.pdf">PDF</a>）</p>
        </td></tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.pdfUrl).toBe(
      "http://www.town.minamitane.kagoshima.jp/assets/files/pdf/gikai/R07dai3kaiteireikaikaigiroku.pdf",
    );
    expect(meetings[0]!.title).toBe("第3回定例会");
    expect(meetings[0]!.year).toBe(2025);
    expect(meetings[0]!.meetingType).toBe("plenary");

    expect(meetings[1]!.pdfUrl).toBe(
      "http://www.town.minamitane.kagoshima.jp/assets/files/pdf/gikai/R7dai4kairinjikaikaigiroku.pdf",
    );
    expect(meetings[1]!.title).toBe("第4回臨時会");
    expect(meetings[1]!.year).toBe(2025);
    expect(meetings[1]!.meetingType).toBe("extraordinary");
  });

  it("複数の年度を正しく処理する", () => {
    const html = `
      <h3>令和6年</h3>
      <table>
        <tr><td>
          <p>第1回定例会（<a href="assets/files/pdf/gikai/R06dai1kaiteireikaikaigiroku.pdf">PDF</a>）</p>
        </td></tr>
      </table>
      <h3>令和5年</h3>
      <table>
        <tr><td>
          <p>第2回定例会（<a href="assets/files/pdf/gikai/R05dai2kaiteireikaikaigiroku.pdf">PDF</a>）</p>
        </td></tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.year).toBe(2024);
    expect(meetings[0]!.title).toBe("第1回定例会");
    expect(meetings[1]!.year).toBe(2023);
    expect(meetings[1]!.title).toBe("第2回定例会");
  });

  it("PDF リンクのないエントリはスキップする", () => {
    const html = `
      <h3>令和6年</h3>
      <table>
        <tr><td>
          <p>第1回定例会（PDF）</p>
          <p>第2回定例会（<a href="assets/files/pdf/gikai/R06dai2kaiteireikaikaigiroku.pdf">PDF</a>）</p>
        </td></tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第2回定例会");
  });

  it("平成の年度を正しくパースする", () => {
    const html = `
      <h3>平成27年</h3>
      <table>
        <tr><td>
          <p>第1回定例会（<a href="assets/files/pdf/gikai/h27dai1kaiteireikaikaigiroku.pdf">PDF</a>）</p>
        </td></tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2015);
    expect(meetings[0]!.title).toBe("第1回定例会");
  });

  it("令和元年を正しくパースする", () => {
    const html = `
      <h3>令和元年</h3>
      <table>
        <tr><td>
          <p>第3回定例会（<a href="assets/files/pdf/gikai/R01dai3kaiteireikaikaigiroku.pdf">PDF</a>）</p>
        </td></tr>
      </table>
    `;

    const meetings = parseListPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.year).toBe(2019);
  });

  it("PDF リンクが一件もない場合は空配列を返す", () => {
    const html = `<html><body><p>データなし</p></body></html>`;
    const meetings = parseListPage(html);
    expect(meetings).toHaveLength(0);
  });
});
