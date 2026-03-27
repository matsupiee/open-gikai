import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  classifyKind,
  extractPageText,
  extractTotalPages,
  parseJapaneseDate,
  parseSpeaker,
  parseStatements,
} from "./detail"

describe("extractTotalPages", () => {
  it("viewer HTML から総ページ数を抽出する", () => {
    const html = `"FILPAGE" : 63, "OPENPAGE" : 1`
    expect(extractTotalPages(html)).toBe(63)
  })
})

describe("extractPageText", () => {
  it("pageTextArea の本文を抽出する", () => {
    const html = `
      <div class="pageTextArea">
        3 ○鈴木議長 皆さん、おはようございます。
      </div>
    `

    expect(extractPageText(html)).toBe("3 ○鈴木議長 皆さん、おはようございます。")
  })
})

describe("parseJapaneseDate", () => {
  it("令和日付を YYYY-MM-DD に変換する", () => {
    expect(parseJapaneseDate("招集年月日時令和6年6月10日午前9時00分")).toBe(
      "2024-06-10",
    )
  })

  it("令和元年に対応する", () => {
    expect(parseJapaneseDate("令和元年5月1日")).toBe("2019-05-01")
  })

  it("日付がない場合は null を返す", () => {
    expect(parseJapaneseDate("日付情報なし")).toBeNull()
  })
})

describe("parseSpeaker", () => {
  it("氏名付き議長を抽出する", () => {
    expect(parseSpeaker("○鈴木議長 皆さん、おはようございます。")).toEqual({
      speakerName: "鈴木",
      speakerRole: "議長",
      content: "皆さん、おはようございます。",
    })
  })

  it("番号付き議員を抽出する", () => {
    expect(
      parseSpeaker("○4番五十嵐議員 おはようございます。4番、五十嵐大将でございます。"),
    ).toEqual({
      speakerName: "五十嵐",
      speakerRole: "議員",
      content: "おはようございます。4番、五十嵐大将でございます。",
    })
  })

  it("部局名付き課長は役職全体を保持する", () => {
    expect(
      parseSpeaker("○樋口産業振興課長 再質問にお答えしたいと思います。"),
    ).toEqual({
      speakerName: null,
      speakerRole: "樋口産業振興課長",
      content: "再質問にお答えしたいと思います。",
    })
  })
})

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark")
  })

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question")
  })

  it("部局名付き課長は answer に分類する", () => {
    expect(classifyKind("樋口産業振興課長")).toBe("answer")
  })
})

describe("parseStatements", () => {
  it("BackShelf テキストを発言単位に分割する", () => {
    const text = [
      "3 ○鈴木議長 皆さん、おはようございます。",
      "◎開会の宣告",
      "○4番五十嵐議員 おはようございます。4番、五十嵐大将でございます。",
      "○佐藤町長 4番、五十嵐大将議員のご質問にお答えをいたします。",
    ].join("\n")

    const result = parseStatements(text)

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      kind: "remark",
      speakerName: "鈴木",
      speakerRole: "議長",
      content: "皆さん、おはようございます。",
    })
    expect(result[0]?.contentHash).toBe(
      createHash("sha256").update("皆さん、おはようございます。").digest("hex"),
    )

    expect(result[1]).toMatchObject({
      kind: "question",
      speakerName: "五十嵐",
      speakerRole: "議員",
    })

    expect(result[2]).toMatchObject({
      kind: "answer",
      speakerName: "佐藤",
      speakerRole: "町長",
    })
  })

  it("offset が連続する", () => {
    const text = [
      "○鈴木議長 開会します。",
      "○佐藤町長 お答えします。",
    ].join("\n")

    const result = parseStatements(text)

    expect(result).toHaveLength(2)
    expect(result[0]?.startOffset).toBe(0)
    expect(result[1]?.startOffset).toBe((result[0]?.endOffset ?? 0) + 1)
  })
})
