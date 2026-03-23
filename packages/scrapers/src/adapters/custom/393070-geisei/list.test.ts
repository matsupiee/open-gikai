import { describe, it, expect } from "vitest";
import { parseDateText, parseYearPage } from "./list";

describe("parseDateText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateText("令和4年3月4日")).toBe("2022-03-04");
  });

  it("令和元年をパースする", () => {
    expect(parseDateText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateText("平成31年3月5日")).toBe("2019-03-05");
  });

  it("平成元年をパースする", () => {
    expect(parseDateText("平成元年4月1日")).toBe("1989-04-01");
  });

  it("PDF リンクテキストの R 形式をパースする", () => {
    expect(parseDateText("R4.3.4会議録")).toBe("2022-03-04");
  });

  it("全角 Ｒ 形式をパースする", () => {
    expect(parseDateText("Ｒ4.3.4会議録")).toBe("2022-03-04");
  });

  it("一般質問を含むリンクテキストをパースする", () => {
    expect(parseDateText("R4.6.13会議録(一般質問)")).toBe("2022-06-13");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateText("会議録表紙・目次")).toBeNull();
  });
});

describe("parseYearPage", () => {
  const PAGE_URL = "https://www.vill.geisei.kochi.jp/pages/m001237.php";

  it("定例会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h6 class="cs_komidasi">【第１回　定例会】</h6>
      <p class="cs_dantext">令和4年3月4日（金）～3月10日（木）</p>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf20220401120000.pdf">R4.3.4会議録</a>
      </div>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf20220401120001.pdf">R4.3.7会議録</a>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.section).toBe("第１回 定例会");
    expect(meetings[0]!.heldOn).toBe("2022-03-04");
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.geisei.kochi.jp/pbfile/m001237/pbf20220401120000.pdf"
    );

    expect(meetings[1]!.heldOn).toBe("2022-03-07");
  });

  it("臨時会の PDF リンクを正しく抽出する", () => {
    const html = `
      <h6 class="cs_komidasi">【第１回　臨時会】</h6>
      <p class="cs_dantext">令和4年1月20日（木）</p>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf20220201100000.pdf">会議録</a>
      </div>
    `;

    // 臨時会の「会議録」には日付がないが、「会議録」を含んでいる
    // ただし日付が取れないのでスキップされる
    const meetings = parseYearPage(html, PAGE_URL);
    expect(meetings).toHaveLength(0);
  });

  it("表紙・目次・通告を含むリンクを除外する", () => {
    const html = `
      <h6 class="cs_komidasi">【第２回　定例会】</h6>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf001.pdf">会議録表紙・目次</a>
      </div>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf002.pdf">R4.6.13会議録</a>
      </div>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf003.pdf">一般質問通告一覧表</a>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-06-13");
  });

  it("一般質問の PDF リンクを正しく抽出する", () => {
    const html = `
      <h6 class="cs_komidasi">【第２回　定例会】</h6>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf001.pdf">R4.6.13会議録(一般質問)</a>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.title).toBe("第２回 定例会 一般質問");
    expect(meetings[0]!.heldOn).toBe("2022-06-13");
  });

  it("複数セクションから正しくセクションを紐付ける", () => {
    const html = `
      <h6 class="cs_komidasi">【第１回　定例会】</h6>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf001.pdf">R4.3.4会議録</a>
      </div>
      <h6 class="cs_komidasi">【第２回　定例会】</h6>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf002.pdf">R4.6.13会議録</a>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.section).toBe("第１回 定例会");
    expect(meetings[1]!.section).toBe("第２回 定例会");
  });

  it("絶対パスの PDF URL を正しく構築する", () => {
    const html = `
      <h6 class="cs_komidasi">【第１回　定例会】</h6>
      <div class="cs_file">
        <a href="/pbfile/m001237/pbf001.pdf">R4.3.4会議録</a>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.vill.geisei.kochi.jp/pbfile/m001237/pbf001.pdf"
    );
  });

  it("RX.XX.XX 形式の全角 Ｒ を含むリンクテキストを処理する", () => {
    const html = `
      <h6 class="cs_komidasi">【第１回　定例会】</h6>
      <div class="cs_file">
        <a href="../pbfile/m001237/pbf001.pdf">Ｒ4.3.4会議録</a>
      </div>
    `;

    const meetings = parseYearPage(html, PAGE_URL);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.heldOn).toBe("2022-03-04");
  });
});
