import { describe, it, expect } from "vitest";
import { parseMeetingList, parseHeldOn, buildTitle } from "./list";

describe("parseHeldOn", () => {
  it("西暦先のパターンをパースする", () => {
    expect(parseHeldOn("2025年（令和7年）3月5日～13日")).toBe("2025-03-01");
  });

  it("月が1桁でも正しくパースする", () => {
    expect(parseHeldOn("2025年（令和7年）6月11日")).toBe("2025-06-01");
  });

  it("12月をパースする", () => {
    expect(parseHeldOn("2024年（令和6年）12月11日～12日")).toBe("2024-12-01");
  });

  it("和暦先のパターンをパースする", () => {
    expect(parseHeldOn("令和6年3月6日～13日")).toBe("2024-03-01");
  });

  it("令和元年に対応する", () => {
    expect(parseHeldOn("2019年（令和元年）6月5日")).toBe("2019-06-01");
  });

  it("平成年号に対応する", () => {
    expect(parseHeldOn("2018年（平成30年）3月5日")).toBe("2018-03-01");
  });

  it("日付情報がない場合は null を返す", () => {
    expect(parseHeldOn("第1回定例会")).toBeNull();
    expect(parseHeldOn("")).toBeNull();
  });
});

describe("buildTitle", () => {
  it("令和年号と会議名を組み合わせる", () => {
    expect(
      buildTitle("議案・会議結果・会議録　令和7年（2025年）", "第1回定例会"),
    ).toBe("令和7年第1回定例会");
  });

  it("全角数字を正規化する", () => {
    expect(
      buildTitle("議案・会議結果・会議録　令和７年（2025年）", "第１回定例会"),
    ).toBe("令和7年第1回定例会");
  });

  it("臨時会のタイトルを生成する", () => {
    expect(
      buildTitle("議案・会議結果・会議録　令和6年（2024年）", "第2回臨時会"),
    ).toBe("令和6年第2回臨時会");
  });

  it("平成年号に対応する", () => {
    expect(
      buildTitle("議案・会議結果・会議録　平成30年（2018年）", "第1回定例会"),
    ).toBe("平成30年第1回定例会");
  });
});

describe("parseMeetingList", () => {
  it("会議録リンクを抽出する", () => {
    const html = `
<h2>議案・会議結果・会議録　令和7年（2025年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2025年（令和7年）3月5日～13日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
    `;

    const meetings = parseMeetingList(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toBe(
      "https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf",
    );
    expect(meetings[0]!.pdfType).toBe("会議録");
    expect(meetings[0]!.heldOn).toBe("2025-03-01");
    expect(meetings[0]!.title).toBe("令和7年第1回定例会");
  });

  it("一般質問リンクを抽出する", () => {
    const html = `
<h2>議案・会議結果・会議録　令和7年（2025年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2025年（令和7年）3月5日～13日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/R7.1定一般質問.pdf">一般質問</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/R7.1定一般質問.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
    `;

    const meetings = parseMeetingList(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("R7.1定一般質問.pdf");
    expect(meetings[0]!.pdfType).toBe("一般質問");
  });

  it("議案・会議結果リンクはスキップする", () => {
    const html = `
<h2>議案・会議結果・会議録　令和7年（2025年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2025年（令和7年）3月5日～13日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/02/★議案まとめ.pdf">議案</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/02/★議案まとめ.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/03/令和７年第１回定例会.pdf">会議結果</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/03/令和７年第１回定例会.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
    `;

    const meetings = parseMeetingList(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfType).toBe("会議録");
  });

  it("対象年以外のセクションはスキップする", () => {
    const html = `
<h2>議案・会議結果・会議録　令和7年（2025年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2025年（令和7年）3月5日～13日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
<h2>議案・会議結果・会議録　令和6年（2024年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2024年（令和6年）3月6日～13日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/04/令和６年第１回定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/04/令和６年第１回定例会会議録.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
    `;

    const meetings = parseMeetingList(html, 2025);

    expect(meetings).toHaveLength(1);
    expect(meetings[0]!.pdfUrl).toContain("2025");
  });

  it("複数の会議が同一年にある場合、全て抽出する", () => {
    const html = `
<h2>議案・会議結果・会議録　令和6年（2024年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2024年（令和6年）3月6日～13日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/04/令和６年第１回定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/04/令和６年第１回定例会会議録.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/04/R6.1定一般質問（発言取り消し後）.pdf">一般質問</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/04/R6.1定一般質問（発言取り消し後）.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
<h4>第3回定例会</h4>
<p>2024年（令和6年）9月24日～30日</p>
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/11/令和６年第３回議会定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2024/11/令和６年第３回議会定例会会議録.pdf" class="wp-block-file__button" download>ダウンロード</a>
</div>
    `;

    const meetings = parseMeetingList(html, 2024);

    expect(meetings).toHaveLength(3);
    expect(meetings[0]!.heldOn).toBe("2024-03-01");
    expect(meetings[0]!.pdfType).toBe("会議録");
    expect(meetings[1]!.heldOn).toBe("2024-03-01");
    expect(meetings[1]!.pdfType).toBe("一般質問");
    expect(meetings[2]!.heldOn).toBe("2024-09-01");
    expect(meetings[2]!.pdfType).toBe("会議録");
  });

  it("PDF リンクがない場合は空配列を返す", () => {
    const html = `
<h2>議案・会議結果・会議録　令和7年（2025年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
<p>2025年（令和7年）3月5日～13日</p>
    `;

    const meetings = parseMeetingList(html, 2025);
    expect(meetings).toHaveLength(0);
  });

  it("対象年の h2 がない場合は空配列を返す", () => {
    const html = `
<h2>議案・会議結果・会議録　令和6年（2024年）</h2>
<h3>定例会</h3>
<h4>第1回定例会</h4>
    `;

    const meetings = parseMeetingList(html, 2025);
    expect(meetings).toHaveLength(0);
  });
});
