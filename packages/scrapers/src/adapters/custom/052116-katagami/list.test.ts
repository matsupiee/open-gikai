import { describe, expect, it } from "vitest";
import { parseYearPage } from "./list";

describe("parseYearPage", () => {
  it("table/th/td 構造から PDF リンクを抽出する", () => {
    const html = `
      <table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
        <caption><p>令和6年会議録</p></caption>
        <tbody>
          <tr>
            <th scope="row">4 第3回定例会</th>
            <td>
              <p>・<a target="_blank" class="icon2" href="//www.city.katagami.lg.jp/material/files/group/13/giroku0609day1.pdf">1日目（令和6年9月4日）(PDFファイル:399.5KB)</a></p>
              <p>・<a target="_blank" class="icon2" href="//www.city.katagami.lg.jp/material/files/group/13/giroku0609day2.pdf">2日目（令和6年9月10日）(PDFファイル:363.9KB)</a></p>
            </td>
          </tr>
          <tr>
            <th scope="row">1 第1回臨時会</th>
            <td>
              <p>・<a target="_blank" class="icon2" href="//www.city.katagami.lg.jp/material/files/group/13/R6220day1.pdf">1日目（令和6年2月20日）(PDFファイル:165.1KB)</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.katagami.lg.jp/material/files/group/13/giroku0609day1.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-09-04");
    expect(meetings[0]!.title).toBe("第3回定例会 1日目");
    expect(meetings[1]!.pdfUrl).toBe(
      "https://www.city.katagami.lg.jp/material/files/group/13/giroku0609day2.pdf",
    );
    expect(meetings[1]!.heldOn).toBe("2024-09-10");
    expect(meetings[2]!.heldOn).toBe("2024-02-20");
    expect(meetings[2]!.title).toBe("第1回臨時会 1日目");
  });

  it("予算決算特別委員会のリンクも抽出する", () => {
    const html = `
      <table border="1">
        <caption>令和6年会議録</caption>
        <tbody>
          <tr>
            <th scope="row">4 第3回定例会</th>
            <td>
              <p>・<a href="//www.city.katagami.lg.jp/material/files/group/13/yosannkessann06091.pdf">予算決算特別委員会1日目（令和6年9月12日）(PDFファイル:142KB)</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.katagami.lg.jp/material/files/group/13/yosannkessann06091.pdf",
    );
    expect(meetings[0]!.heldOn).toBe("2024-09-12");
    expect(meetings[0]!.title).toContain("委員会");
  });

  it("日付が取得できないリンクはスキップする", () => {
    const html = `
      <table border="1">
        <caption>令和6年会議録</caption>
        <tbody>
          <tr>
            <th scope="row">1 第1回定例会</th>
            <td>
              <p>・<a href="//www.city.katagami.lg.jp/material/files/group/13/doc.pdf">会議録(PDFファイル:100KB)</a></p>
              <p>・<a href="//www.city.katagami.lg.jp/material/files/group/13/doc2.pdf">1日目（令和6年3月1日）(PDFファイル:200KB)</a></p>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
  });

  it("caption がない table はスキップする", () => {
    const html = `
      <table border="1">
        <tbody>
          <tr>
            <th>第1回定例会</th>
            <td>
              <a href="//www.city.katagami.lg.jp/material/files/group/13/doc.pdf">1日目（令和6年1月1日）</a>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(0);
  });

  it("平成年代の日付も正しく解析する", () => {
    const html = `
      <table border="1">
        <caption>平成30年会議録</caption>
        <tbody>
          <tr>
            <th scope="row">7 第4回定例会</th>
            <td>
              <ul>
                <li><a href="//www.city.katagami.lg.jp/material/files/group/13/20190218-132127.pdf">1日目（平成30年12月4日）（PDFファイル:525.1KB）</a></li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2018-12-04");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.city.katagami.lg.jp/material/files/group/13/20190218-132127.pdf",
    );
  });

  it("複数の table が存在する場合は全て処理する", () => {
    const html = `
      <table border="1">
        <caption>令和6年会議録</caption>
        <tbody>
          <tr>
            <th>第1回定例会</th>
            <td>
              <a href="//www.city.katagami.lg.jp/material/files/group/13/a.pdf">1日目（令和6年3月1日）</a>
            </td>
          </tr>
        </tbody>
      </table>
      <table border="1">
        <caption>令和5年会議録</caption>
        <tbody>
          <tr>
            <th>第1回定例会</th>
            <td>
              <a href="//www.city.katagami.lg.jp/material/files/group/13/b.pdf">1日目（令和5年3月3日）</a>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const meetings = parseYearPage(html);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[1]!.heldOn).toBe("2023-03-03");
  });
});
