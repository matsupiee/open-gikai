import { describe, test, expect } from "vitest";
import { isProcedural, buildChunksFromStatements } from "./statement-chunking";

describe("isProcedural", () => {
  test("○ で始まる発言は手続き系", () => {
    expect(isProcedural("○議長が開会を宣言しました。")).toBe(true);
  });

  test("△ で始まる発言は手続き系", () => {
    expect(isProcedural("△開会の宣告")).toBe(true);
  });

  test("◆ + 20文字未満は手続き系", () => {
    expect(isProcedural("◆了解しました。")).toBe(true);
  });

  test("◎ + 20文字未満は手続き系", () => {
    expect(isProcedural("◎異議なし")).toBe(true);
  });

  test("◆ + ～xxx～パターン + 50文字未満は手続き系", () => {
    expect(isProcedural("◆委員長　～説明員紹介～")).toBe(true);
  });

  test("◎ + ～xxx～パターン + 50文字未満は手続き系", () => {
    expect(isProcedural("◎議長　～休憩宣告～　ここで休憩します")).toBe(true);
  });

  test("◆ + 50文字以上の実質的発言は手続き系ではない", () => {
    const longContent =
      "◆委員の佐藤です。本日の議案について質問いたします。市の予算案について、特に教育費の増額理由についてお伺いしたい。";
    expect(isProcedural(longContent)).toBe(false);
  });

  test("◎ + 20文字以上で～パターンなしは手続き系ではない", () => {
    expect(isProcedural("◎市長として、この件については慎重に検討いたします。")).toBe(
      false,
    );
  });

  test("通常の発言は手続き系ではない", () => {
    expect(isProcedural("防災対策について質問いたします。")).toBe(false);
  });
});

describe("buildChunksFromStatements", () => {
  test("手続き系発言を除外してチャンクを構築する", () => {
    const statements = [
      {
        id: "stmt-1",
        speakerName: "議長",
        speakerRole: "議長",
        content: "○ただいまから会議を開きます。",
      },
      {
        id: "stmt-2",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: "防災対策について質問いたします。",
      },
      {
        id: "stmt-3",
        speakerName: "鈴木一郎",
        speakerRole: "市長",
        content: "お答えいたします。防災計画を見直しました。",
      },
    ];

    const chunks = buildChunksFromStatements(statements);

    // ○で始まる stmt-1 は除外される
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.speakerName).toBe("佐藤花子");
    expect(chunks[0]!.statementIds).toEqual(["stmt-2"]);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[1]!.speakerName).toBe("鈴木一郎");
    expect(chunks[1]!.statementIds).toEqual(["stmt-3"]);
  });

  test("同一スピーカーの連続発言をグループ化する", () => {
    const statements = [
      {
        id: "stmt-1",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: "第一の質問です。",
      },
      {
        id: "stmt-2",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: "第二の質問です。",
      },
      {
        id: "stmt-3",
        speakerName: "鈴木一郎",
        speakerRole: "市長",
        content: "お答えします。",
      },
    ];

    const chunks = buildChunksFromStatements(statements);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.statementIds).toEqual(["stmt-1", "stmt-2"]);
    expect(chunks[0]!.content).toBe("第一の質問です。\n第二の質問です。");
    expect(chunks[1]!.statementIds).toEqual(["stmt-3"]);
  });

  test("MAX_CHUNK_CHARS (1500) を超えるとチャンクを分割する", () => {
    const longText = "あ".repeat(800);
    const statements = [
      {
        id: "stmt-1",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: longText,
      },
      {
        id: "stmt-2",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: longText,
      },
      {
        id: "stmt-3",
        speakerName: "佐藤花子",
        speakerRole: "議員",
        content: "短い発言",
      },
    ];

    const chunks = buildChunksFromStatements(statements);

    // 800 + 800 = 1600 > 1500 なので2チャンクに分割
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[1]!.chunkIndex).toBe(1);
    // 全チャンクが同じスピーカー
    for (const chunk of chunks) {
      expect(chunk.speakerName).toBe("佐藤花子");
    }
  });

  test("空の入力は空配列を返す", () => {
    expect(buildChunksFromStatements([])).toEqual([]);
  });

  test("全て手続き系の場合は空配列を返す", () => {
    const statements = [
      {
        id: "stmt-1",
        speakerName: "議長",
        speakerRole: "議長",
        content: "○開会します。",
      },
      {
        id: "stmt-2",
        speakerName: null,
        speakerRole: null,
        content: "△議事日程",
      },
    ];

    expect(buildChunksFromStatements(statements)).toEqual([]);
  });
});
