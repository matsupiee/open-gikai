import { describe, expect, it } from "vitest";
import { parseDateFromIinkaiText, parseYearPage } from "./list";

describe("parseDateFromIinkaiText", () => {
  it("令和年の委員会日付を正しくパースする", () => {
    expect(
      parseDateFromIinkaiText(
        "令和6年12月12日 総務まちづくり常任委員会 会議録",
        2024
      )
    ).toBe("2024-12-12");
  });

  it("令和7年の日付を正しくパースする", () => {
    expect(
      parseDateFromIinkaiText(
        "令和7年6月4日 総務まちづくり常任委員会 会議録",
        2025
      )
    ).toBe("2025-06-04");
  });

  it("月・日が1桁でもゼロパディングされる", () => {
    expect(
      parseDateFromIinkaiText("令和6年3月5日 福祉文教常任委員会 会議録", 2024)
    ).toBe("2024-03-05");
  });

  it("平成年の委員会日付を正しくパースする", () => {
    expect(
      parseDateFromIinkaiText(
        "平成31年3月7日 総務まちづくり常任委員会 会議録",
        2019
      )
    ).toBe("2019-03-07");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromIinkaiText("会議録", 2024)).toBeNull();
  });
});

describe("parseYearPage", () => {
  it("h2 見出し（本会議）と PDF リンクを正しく抽出する", () => {
    const html = `
      <h2>本会議</h2>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R6dai4kaiteireikai.pdf">令和6年第4回定例会 会議録</a>(PDFファイル: 561.7KB)</li>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R6dai1kairinjikai.pdf">令和6年第1回臨時会 会議録</a>(PDFファイル: 123.4KB)</li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.section).toBe("本会議");
    expect(meetings[0]!.title).toBe("令和6年第4回定例会 会議録");
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.taishi.osaka.jp/material/files/group/6/R6dai4kaiteireikai.pdf"
    );

    expect(meetings[1]!.section).toBe("本会議");
    expect(meetings[1]!.title).toBe("令和6年第1回臨時会 会議録");
    expect(meetings[1]!.heldOn).toBeNull();
  });

  it("h2 見出し（常任委員会）と h3 見出し（各委員会名）を正しく抽出する", () => {
    const html = `
      <h2>常任委員会</h2>
      <h3>総務まちづくり常任委員会</h3>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R61212soumati.pdf">令和6年12月12日 総務まちづくり常任委員会 会議録</a></li>
      </ul>
      <h3>福祉文教常任委員会</h3>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R060906fukubunkaigiroku.pdf">令和6年9月6日 福祉文教常任委員会 会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);

    expect(meetings[0]!.section).toBe("総務まちづくり常任委員会");
    expect(meetings[0]!.title).toBe(
      "令和6年12月12日 総務まちづくり常任委員会 会議録"
    );
    expect(meetings[0]!.heldOn).toBe("2024-12-12");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.taishi.osaka.jp/material/files/group/6/R61212soumati.pdf"
    );

    expect(meetings[1]!.section).toBe("福祉文教常任委員会");
    expect(meetings[1]!.title).toBe(
      "令和6年9月6日 福祉文教常任委員会 会議録"
    );
    expect(meetings[1]!.heldOn).toBe("2024-09-06");
  });

  it("本会議と常任委員会が混在するページを正しく抽出する", () => {
    const html = `
      <h2>本会議</h2>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R6dai1teireikaigiroku.pdf">令和6年第1回定例会 会議録</a></li>
      </ul>
      <h2>常任委員会</h2>
      <h3>総務まちづくり常任委員会</h3>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R060604soumachi.pdf">令和6年6月4日 総務まちづくり常任委員会 会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.section).toBe("本会議");
    expect(meetings[0]!.heldOn).toBeNull();
    expect(meetings[1]!.section).toBe("総務まちづくり常任委員会");
    expect(meetings[1]!.heldOn).toBe("2024-06-04");
  });

  it("/material/files/ 以外の PDF リンクはスキップする", () => {
    const html = `
      <h2>本会議</h2>
      <ul>
        <li><a href="/other/path/document.pdf">別の文書</a></li>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R6dai1teireikaigiroku.pdf">令和6年第1回定例会 会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.taishi.osaka.jp/material/files/group/6/R6dai1teireikaigiroku.pdf"
    );
  });

  it("プロトコル相対 URL（//www.town.taishi.osaka.jp/...）を正しく変換する", () => {
    const html = `
      <h2>本会議</h2>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R6dai4kaiteireikai.pdf">令和6年第4回定例会 会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2024);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.taishi.osaka.jp/material/files/group/6/R6dai4kaiteireikai.pdf"
    );
  });

  it("対応していない年度では HTML が空でも空配列を返す", () => {
    const meetings = parseYearPage("", 1999);
    expect(meetings).toHaveLength(0);
  });

  it("令和7年の予算常任委員会リンクを正しく抽出する", () => {
    const html = `
      <h2>常任委員会</h2>
      <h3>予算常任委員会</h3>
      <ul>
        <li><a href="//www.town.taishi.osaka.jp/material/files/group/6/R070604_soumachi.pdf">令和7年6月4日 予算常任委員会 会議録</a></li>
      </ul>
    `;

    const meetings = parseYearPage(html, 2025);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.section).toBe("予算常任委員会");
    expect(meetings[0]!.heldOn).toBe("2025-06-04");
  });
});
