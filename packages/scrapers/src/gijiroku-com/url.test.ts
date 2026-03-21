import { describe, expect, test } from "vitest";
import { extractBaseInfo } from "./url";

describe("extractBaseInfo", () => {
  test("/voices/ パスの gijiroku.com URL", () => {
    const info = extractBaseInfo(
      "http://sapporo.gijiroku.com/voices/g07v_search.asp"
    );
    expect(info).toEqual({
      origin: "https://sapporo.gijiroku.com",
      basePath: "/voices",
    });
  });

  test("サブディレクトリ + /voices/ パス", () => {
    const info = extractBaseInfo(
      "http://warabi.gijiroku.com/gikai/voices/g08v_search.asp"
    );
    expect(info).toEqual({
      origin: "https://warabi.gijiroku.com",
      basePath: "/gikai/voices",
    });
  });

  test("VOICES 大文字パス（自前ホスト）", () => {
    const info = extractBaseInfo(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/g08v_search.asp"
    );
    expect(info).toEqual({
      origin: "http://info.city.chigasaki.kanagawa.jp",
      basePath: "/VOICES",
    });
  });

  test("/voices/ を含まない gijiroku.com URL", () => {
    const info = extractBaseInfo(
      "https://www13.gijiroku.com/kawasaki_council/g07v_search.asp?Sflg=2"
    );
    expect(info).toEqual({
      origin: "https://www13.gijiroku.com",
      basePath: "/kawasaki_council",
    });
  });

  test("末尾スラッシュのみのパス", () => {
    const info = extractBaseInfo("http://www06.gijiroku.com/niigata/");
    expect(info).toEqual({
      origin: "https://www06.gijiroku.com",
      basePath: "/niigata",
    });
  });

  test("/gikai/ パス（東大阪市等）", () => {
    const info = extractBaseInfo(
      "http://higashiosaka.gijiroku.com/gikai/g08v_search.asp"
    );
    expect(info).toEqual({
      origin: "https://higashiosaka.gijiroku.com",
      basePath: "/gikai",
    });
  });

  test("gijiroku.com は HTTPS に変換", () => {
    const info = extractBaseInfo(
      "http://tsukuba.gijiroku.com/voices/g08v_search.asp"
    );
    expect(info!.origin).toBe("https://tsukuba.gijiroku.com");
  });

  test("自前ホストは HTTP を保持", () => {
    const info = extractBaseInfo(
      "http://info.city.chigasaki.kanagawa.jp/VOICES/g08v_search.asp"
    );
    expect(info!.origin).toBe("http://info.city.chigasaki.kanagawa.jp");
  });

  test("ルートパスのみは null", () => {
    expect(extractBaseInfo("http://example.com/")).toBeNull();
  });

  test("不正な URL は null", () => {
    expect(extractBaseInfo("not-a-url")).toBeNull();
  });
});
