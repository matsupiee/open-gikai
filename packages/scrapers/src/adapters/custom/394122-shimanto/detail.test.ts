import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractBodyText, extractMeta } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("○議長（緒方正綱君）ただいまから会議を開きます。");

    expect(result.speakerName).toBe("緒方正綱");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（中尾博憲君）お答えします。");

    expect(result.speakerName).toBe("中尾博憲");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えします。");
  });

  it("全角番号議員パターンを議員として解析する", () => {
    const result = parseSpeaker("○４番（村井眞菜君）質問いたします。");

    expect(result.speakerName).toBe("村井眞菜");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号議員パターンを議員として解析する", () => {
    const result = parseSpeaker("○11番（下元真之君）一般質問を行います。");

    expect(result.speakerName).toBe("下元真之");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問を行います。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○企画課長（冨田努君）ご説明いたします。");

    expect(result.speakerName).toBe("冨田努");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育次長パターンを解析する", () => {
    const result = parseSpeaker("○教育次長（川上武史君）お答えします。");

    expect(result.speakerName).toBe("川上武史");
    expect(result.speakerRole).toBe("教育次長");
    expect(result.content).toBe("お答えします。");
  });

  it("にぎわい創出課長などの長い役職名を正しく解析する", () => {
    const result = parseSpeaker("○にぎわい創出課長（小笹義博君）お答えします。");

    expect(result.speakerName).toBe("小笹義博");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えします。");
  });

  it("副委員長パターンを副委員長として解析する（委員長より長いので誤マッチしない）", () => {
    const result = parseSpeaker("○副委員長（田中一郎君）暫時休憩します。");

    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("暫時休憩します。");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類される", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark に分類される", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark に分類される", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark に分類される", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("町長は answer に分類される", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer に分類される", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育次長は answer に分類される", () => {
    expect(classifyKind("教育次長")).toBe("answer");
  });

  it("議員は question に分類される", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark に分類される", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言を分割して ParsedStatement 配列を返す", () => {
    const text = [
      "○議長（緒方正綱君）ただいまから会議を開きます。",
      "○１番（山田太郎君）一般質問を行います。",
      "○町長（中尾博憲君）お答えします。",
    ].join(" ");

    const statements = parseStatements(text);

    expect(statements).not.toBeNull();
    expect(statements!).toHaveLength(3);

    expect(statements![0]!.kind).toBe("remark");
    expect(statements![0]!.speakerName).toBe("緒方正綱");
    expect(statements![0]!.speakerRole).toBe("議長");
    expect(statements![0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements![1]!.kind).toBe("question");
    expect(statements![1]!.speakerName).toBe("山田太郎");
    expect(statements![1]!.speakerRole).toBe("議員");

    expect(statements![2]!.kind).toBe("answer");
    expect(statements![2]!.speakerName).toBe("中尾博憲");
    expect(statements![2]!.speakerRole).toBe("町長");
  });

  it("○マーカーがないテキストは null を返す", () => {
    const result = parseStatements("会期中の審議結果をまとめる。");
    expect(result).toBeNull();
  });

  it("空テキストは null を返す", () => {
    expect(parseStatements("")).toBeNull();
    expect(parseStatements("   ")).toBeNull();
  });

  it("○マーカーがあっても有効な発言がない場合は null を返す", () => {
    // 全て短すぎるマーカーのみ
    const result = parseStatements("○ ○ ○");
    expect(result).toBeNull();
  });

  it("contentHash が SHA-256 ハッシュになる", () => {
    const text = "○議長（緒方正綱君）ただいまから会議を開きます。";
    const statements = parseStatements(text);

    expect(statements).not.toBeNull();
    expect(statements![0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("startOffset と endOffset が正しく設定される", () => {
    const text = [
      "○議長（緒方正綱君）開会します。",
      "○１番（山田太郎君）質問します。",
    ].join(" ");

    const statements = parseStatements(text);

    expect(statements).not.toBeNull();
    expect(statements![0]!.startOffset).toBe(0);
    expect(statements![0]!.endOffset).toBe(statements![0]!.content.length);
    expect(statements![1]!.startOffset).toBe(statements![0]!.endOffset + 1);
  });

  it("ト書き（登壇）は除外される", () => {
    const text = [
      "○議長（緒方正綱君）登壇します。",
      "○議長（緒方正綱君）ただいまから会議を開きます。",
    ].join(" ");

    // 登壇は完全に「○xxx（xxx）登壇」のみ除外
    const statements = parseStatements(text);
    expect(statements).not.toBeNull();
  });
});

describe("extractBodyText", () => {
  it("pre タグ内のテキストを抽出する", () => {
    const html = `
      <html>
        <body>
          <pre>
○議長（緒方正綱君）ただいまから会議を開きます。
○１番（山田太郎君）質問いたします。
          </pre>
        </body>
      </html>
    `;

    const text = extractBodyText(html);

    expect(text).toContain("○議長（緒方正綱君）");
    expect(text).toContain("○１番（山田太郎君）");
  });

  it("HTML タグが除去される", () => {
    const html = `<pre><b>○議長</b>（緒方正綱君）開会します。</pre>`;

    const text = extractBodyText(html);

    expect(text).toContain("○議長");
    expect(text).not.toContain("<b>");
  });

  it("HTML エンティティが変換される", () => {
    const html = `<pre>○議長（緒方正綱君）&amp;amp;テスト &lt;内容&gt;</pre>`;

    const text = extractBodyText(html);

    expect(text).toContain("&amp;テスト <内容>");
  });
});

describe("extractMeta", () => {
  it("パンくずリストから会議名と開催日を抽出する", () => {
    const html = `
      <div class="breadcrumb">
        <a href="/gijiroku/">会議録</a> &raquo;
        <a href="/gijiroku/?hdnKatugi=130&hdnYear=2026">令和８年</a> &raquo;
        令和８年第１回臨時会(開催日:2026/01/29)
      </div>
    `;

    const meta = extractMeta(html);

    expect(meta.heldOn).toBe("2026-01-29");
    expect(meta.title).toContain("令和８年第１回臨時会");
  });

  it("開催日がない場合は heldOn が null になる", () => {
    const html = `<div>令和６年第３回定例会</div>`;

    const meta = extractMeta(html);

    expect(meta.heldOn).toBeNull();
  });
});
