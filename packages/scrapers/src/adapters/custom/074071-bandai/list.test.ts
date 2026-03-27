import { describe, expect, it } from "vitest"
import { parseListPage } from "./list"
import { detectMeetingType, parseWarekiYear, toHalfWidth } from "./shared"

describe("toHalfWidth", () => {
  it("全角数字を半角数字に変換する", () => {
    expect(toHalfWidth("令和７年１２月")).toBe("令和7年12月")
  })
})

describe("parseWarekiYear", () => {
  it("令和を西暦に変換する", () => {
    expect(parseWarekiYear("令和7年定例会")).toBe(2025)
  })

  it("令和元年に対応する", () => {
    expect(parseWarekiYear("令和元年定例会")).toBe(2019)
  })

  it("平成元年に対応する", () => {
    expect(parseWarekiYear("平成元年臨時会")).toBe(1989)
  })
})

describe("detectMeetingType", () => {
  it("定例会を plenary と判定する", () => {
    expect(detectMeetingType("令和７年３月定例会会議録")).toBe("plenary")
  })

  it("臨時会を extraordinary と判定する", () => {
    expect(detectMeetingType("令和７年４月臨時会会議録")).toBe("extraordinary")
  })
})

describe("parseListPage", () => {
  it("年見出しごとの BackShelf リンクを抽出する", () => {
    const html = `
      <div class="detail_free">
        <h2 align="left">令和７年定例会</h2>
        <ul>
          <li><a href="https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=abc">令和７年３月定例会会議録</a></li>
          <li><a href="https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=def">令和７年６月定例会会議録</a></li>
        </ul>
        <h2 align="left">令和６年定例会</h2>
        <ul>
          <li><a href="https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=ghi">令和６年12月定例会会議録</a></li>
        </ul>
      </div>
    `

    const result = parseListPage(html)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      title: "令和７年３月定例会会議録",
      openUrl:
        "https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=abc",
      year: 2025,
      meetingType: "plenary",
    })
    expect(result[2]?.year).toBe(2024)
  })

  it("タイトルから年を補完できる", () => {
    const html = `
      <ul>
        <li><a href="https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=abc">令和６年９月定例会会議録</a></li>
      </ul>
    `

    const result = parseListPage(html)

    expect(result).toHaveLength(1)
    expect(result[0]?.year).toBe(2024)
  })

  it("同一リンクの重複を除外する", () => {
    const html = `
      <h2>令和７年定例会</h2>
      <ul>
        <li><a href="https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=abc">令和７年３月定例会会議録</a></li>
        <li><a href="https://open.backshelf.jp/?server=https%3A%2F%2Ftown-bandai-pr.backshelf.jp%2F&key=abc">令和７年３月定例会会議録</a></li>
      </ul>
    `

    const result = parseListPage(html)

    expect(result).toHaveLength(1)
  })
})

