import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("括弧付きの話者表記を解析する", () => {
    expect(parseSpeaker("委員長（羽沢寿隆君）")).toEqual({
      speakerName: "羽沢寿隆",
      speakerRole: "委員長",
    });
  });

  it("役職と氏名が空白区切りの表記を解析する", () => {
    expect(parseSpeaker("建設課長　工藤　剛君")).toEqual({
      speakerName: "工藤剛",
      speakerRole: "課長",
    });
  });

  it("番号付き議員を議員として扱う", () => {
    expect(parseSpeaker("12番　渡辺義光議員")).toEqual({
      speakerName: "渡辺義光",
      speakerRole: "議員",
    });
  });
});

describe("classifyKind", () => {
  it("議長・委員長は remark を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("行政側の役職は answer を返す", () => {
    expect(classifyKind("市長")).toBe("answer");
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員・委員は question を返す", () => {
    expect(classifyKind("議員")).toBe("question");
    expect(classifyKind("委員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("HTML 本文から発言のみを抽出する", () => {
    const html = `
      <html>
        <body>
          <pre>
            <a name="0007"></a><b>開　　　　　議</b><br>
            〇<b>委員長（羽沢寿隆君）</b>　会議は、会議次第により進めてまいります。<br>
            　　　　　橋悦郎委員。<br>
            〇<b>委員　橋悦郎君</b>　28ページの社会資本整備総合交付金について伺います。<br>
            　　　　　今年度は1億6,200万円ほど計上されております。<br>
            　　　　　　　　　　　　（市長　佐々木孝弘君登壇）<br>
            〇<b>市長　佐々木孝弘君</b>　お答えします。<br>
          </pre>
        </body>
      </html>
    `;

    const result = parseStatements(html);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      kind: "remark",
      speakerName: "羽沢寿隆",
      speakerRole: "委員長",
      content: "会議は、会議次第により進めてまいります。 橋悦郎委員。",
      contentHash: createHash("sha256")
        .update("会議は、会議次第により進めてまいります。 橋悦郎委員。")
        .digest("hex"),
      startOffset: 0,
      endOffset: 27,
    });
    expect(result[1]).toEqual({
      kind: "question",
      speakerName: "橋悦郎",
      speakerRole: "委員",
      content:
        "28ページの社会資本整備総合交付金について伺います。 今年度は1億6,200万円ほど計上されております。",
      contentHash: createHash("sha256")
        .update(
          "28ページの社会資本整備総合交付金について伺います。 今年度は1億6,200万円ほど計上されております。",
        )
        .digest("hex"),
      startOffset: 28,
      endOffset: 80,
    });
    expect(result[2]).toEqual({
      kind: "answer",
      speakerName: "佐々木孝弘",
      speakerRole: "市長",
      content: "お答えします。",
      contentHash: createHash("sha256").update("お答えします。").digest("hex"),
      startOffset: 81,
      endOffset: 88,
    });
  });
});
