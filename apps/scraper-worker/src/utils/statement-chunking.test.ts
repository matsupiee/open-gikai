import { describe, expect, test } from "vitest";
import {
  isProcedural,
  buildChunksFromStatements,
  type StatementRecord,
} from "./statement-chunking";

describe("isProcedural", () => {
  test("○で始まる発言は手続き系", () => {
    expect(isProcedural("○議長（高瀬博文）　ただいまから会議を開きます。")).toBe(true);
  });

  test("△で始まる発言は手続き系", () => {
    expect(isProcedural("△午前10時開議")).toBe(true);
  });

  test("◆で始まる20文字未満の発言は手続き系", () => {
    expect(isProcedural("◆理解しました。")).toBe(true);
  });

  test("◎で始まる20文字未満の発言は手続き系", () => {
    expect(isProcedural("◎了解です")).toBe(true);
  });

  test("◆で始まる50文字未満で～xxx～パターンは手続き系", () => {
    expect(isProcedural("◆～説明員紹介～これは手続きです")).toBe(true);
  });

  test("◆で始まるが50文字以上の発言は手続き系ではない", () => {
    const long = "◆" + "あ".repeat(60);
    expect(isProcedural(long)).toBe(false);
  });

  test("◆で始まる20文字以上で～パターンなしは手続き系ではない", () => {
    const content = "◆これは手続きではなく実質的な発言内容です。";
    expect(isProcedural(content)).toBe(false);
  });

  test("通常の発言は手続き系ではない", () => {
    expect(isProcedural("私は賛成です。理由は以下の通りです。")).toBe(false);
  });
});

describe("buildChunksFromStatements", () => {
  function makeStatement(
    id: string,
    speakerName: string | null,
    content: string
  ): StatementRecord {
    return { id, speakerName, speakerRole: null, content };
  }

  test("空配列 → 空配列", () => {
    expect(buildChunksFromStatements([])).toEqual([]);
  });

  test("手続き系発言は除外される", () => {
    const stmts: StatementRecord[] = [
      makeStatement("1", "議長", "○議長　開会します。"),
      makeStatement("2", "田中", "賛成です。"),
    ];
    const chunks = buildChunksFromStatements(stmts);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe("賛成です。");
  });

  test("連続する同一スピーカーの発言はグループ化される", () => {
    const stmts: StatementRecord[] = [
      makeStatement("1", "田中", "まず第一に、"),
      makeStatement("2", "田中", "次に第二に、"),
      makeStatement("3", "佐藤", "反対です。"),
    ];
    const chunks = buildChunksFromStatements(stmts);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.speakerName).toBe("田中");
    expect(chunks[0]!.statementIds).toEqual(["1", "2"]);
    expect(chunks[0]!.content).toBe("まず第一に、\n次に第二に、");
    expect(chunks[1]!.speakerName).toBe("佐藤");
  });

  test("1500文字を超えるグループはチャンク分割される", () => {
    const longContent = "あ".repeat(800);
    const stmts: StatementRecord[] = [
      makeStatement("1", "田中", longContent),
      makeStatement("2", "田中", longContent),
      makeStatement("3", "田中", longContent),
    ];
    const chunks = buildChunksFromStatements(stmts);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[1]!.chunkIndex).toBe(1);
    expect(chunks[0]!.speakerName).toBe("田中");
    expect(chunks[1]!.speakerName).toBe("田中");
  });

  test("全て手続き系の場合は空配列", () => {
    const stmts: StatementRecord[] = [
      makeStatement("1", "議長", "○議長　開会します。"),
      makeStatement("2", "議長", "△午前10時開議"),
    ];
    expect(buildChunksFromStatements(stmts)).toEqual([]);
  });
});
