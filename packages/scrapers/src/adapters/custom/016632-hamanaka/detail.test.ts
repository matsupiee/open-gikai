import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長の発言をパースする", () => {
    expect(parseSpeaker("○議長（落合俊雄君） これから本日の会議を開きます。")).toEqual({
      speakerName: "落合俊雄",
      speakerRole: "議長",
      content: "これから本日の会議を開きます。",
    });
  });

  it("番号付き議員を議員として扱う", () => {
    expect(parseSpeaker("○１番（三上浅雄君） 皆さん、おはようございます。")).toEqual({
      speakerName: "三上浅雄",
      speakerRole: "議員",
      content: "皆さん、おはようございます。",
    });
  });

  it("課長答弁をパースする", () => {
    expect(
      parseSpeaker(
        "○企画財政課長（渡部幸平君） それでは、議案第１２号について説明します。",
      ),
    ).toEqual({
      speakerName: "渡部幸平",
      speakerRole: "企画財政課長",
      content: "それでは、議案第１２号について説明します。",
    });
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("企画財政課長は answer", () => {
    expect(classifyKind("企画財政課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("○マーカーごとに発言を分割する", () => {
    const text = `
      ○議長（落合俊雄君） ただいまから令和７年第１回浜中町議会定例会を開会します。
      ○１番（三上浅雄君） 皆さん、おはようございます。議会運営委員会委員長報告を行います。
      ○町長（齊藤清隆君） 皆さん、おはようございます。本日、第１回浜中町議会定例会にご出席をいただき、誠にありがとうございます。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("落合俊雄");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから令和７年第１回浜中町議会定例会を開会します。")
        .digest("hex"),
    );

    expect(statements[1]!.speakerName).toBe("三上浅雄");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("齊藤清隆");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ページ番号ノイズを無視する", () => {
    const text = `
      - 31 -
      ○議長（落合俊雄君） この際、暫時休憩とします。

      - 32 -
      ○議長（落合俊雄君） 休憩前に引き続き、会議を開きます。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("この際、暫時休憩とします。");
    expect(statements[1]!.content).toBe("休憩前に引き続き、会議を開きます。");
  });

  it("話者マーカーがない場合は空配列を返す", () => {
    expect(parseStatements("議事日程のみが掲載されています。")).toEqual([]);
  });
});
