import { describe, expect, test } from "vitest";
import {
  parseDateFromFilename,
  extractSlugFromUrl,
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
} from "./list";

describe("parseDateFromFilename", () => {
  test("令和の日付を解析 (R080106)", () => {
    expect(parseDateFromFilename("R080106B02")).toBe("2026-01-06");
  });

  test("平成の日付を解析 (H310401)", () => {
    expect(parseDateFromFilename("H310401")).toBe("2019-04-01");
  });

  test("昭和の日付を解析 (S600315)", () => {
    expect(parseDateFromFilename("S600315")).toBe("1985-03-15");
  });

  test("小文字のエラ文字にも対応", () => {
    expect(parseDateFromFilename("r060101")).toBe("2024-01-01");
  });

  test("月が00の場合は01にフォールバック", () => {
    expect(parseDateFromFilename("R080001")).toBe("2026-01-01");
  });

  test("日が00の場合は01にフォールバック", () => {
    expect(parseDateFromFilename("R080100")).toBe("2026-01-01");
  });

  test("不正な形式は null", () => {
    expect(parseDateFromFilename("invalid")).toBeNull();
  });

  test("未知のエラ文字は null", () => {
    expect(parseDateFromFilename("X080101")).toBeNull();
  });
});

describe("extractSlugFromUrl", () => {
  test("kensakusystem.jp のスラッグを抽出", () => {
    expect(
      extractSlugFromUrl(
        "https://www.kensakusystem.jp/cityname/sapphire.html"
      )
    ).toBe("cityname");
  });

  test("マッチしない場合は null", () => {
    expect(extractSlugFromUrl("https://example.com/page")).toBeNull();
  });
});

describe("URL タイプ判定", () => {
  test("isSapphireType", () => {
    expect(
      isSapphireType(
        "https://www.kensakusystem.jp/city/sapphire.html"
      )
    ).toBe(true);
    expect(
      isSapphireType("https://www.kensakusystem.jp/city/index.html")
    ).toBe(false);
  });

  test("isCgiType", () => {
    expect(
      isCgiType("https://www.kensakusystem.jp/city/cgi/Search2.exe")
    ).toBe(true);
    expect(
      isCgiType("https://www.kensakusystem.jp/city/sapphire.html")
    ).toBe(false);
  });

  test("isIndexHtmlType", () => {
    expect(
      isIndexHtmlType("https://www.kensakusystem.jp/city/index.html")
    ).toBe(true);
    expect(
      isIndexHtmlType(
        "https://www.kensakusystem.jp/city/sapphire.html"
      )
    ).toBe(false);
  });
});
