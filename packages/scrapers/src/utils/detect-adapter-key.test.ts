import { describe, test, expect } from "vitest";
import { detectAdapterKey, SharedSystemAdapterKey } from "./detect-adapter-key";

describe("detectAdapterKey", () => {
  const fallback = "custom-123456";

  test("ssp.kaigiroku.net は discussnet", () => {
    expect(detectAdapterKey("https://ssp.kaigiroku.net/foo", fallback)).toBe(
      SharedSystemAdapterKey.DISCUSSNET,
    );
  });

  test("/tenant/{slug}/ は discussnet", () => {
    expect(detectAdapterKey("https://example.jp/tenant/my-city/", fallback)).toBe(
      SharedSystemAdapterKey.DISCUSSNET,
    );
  });

  test("dbsr.jp は dbsearch", () => {
    expect(detectAdapterKey("https://www.dbsr.jp/search", fallback)).toBe(
      SharedSystemAdapterKey.DBSEARCH,
    );
  });

  test("kensakusystem.jp（-vod/ なし）は kensakusystem", () => {
    expect(detectAdapterKey("https://foo.kensakusystem.jp/list", fallback)).toBe(
      SharedSystemAdapterKey.KENSAKUSYSTEM,
    );
  });

  test("kensakusystem.jp かつ -vod/ を含む場合は kensakusystem にしない", () => {
    expect(detectAdapterKey("https://foo.kensakusystem.jp/-vod/bar", fallback)).toBe(fallback);
  });

  test("gijiroku.com は gijirokucom", () => {
    expect(detectAdapterKey("https://www.gijiroku.com/x", fallback)).toBe(
      SharedSystemAdapterKey.GIJIROKUCOM,
    );
  });

  test("/VOICES/ は gijirokucom（大文字小文字を区別しない）", () => {
    expect(detectAdapterKey("https://city.example.jp/VoIcEs/search", fallback)).toBe(
      SharedSystemAdapterKey.GIJIROKUCOM,
    );
  });

  test("g07v_search.asp は gijirokucom", () => {
    expect(detectAdapterKey("https://city.jp/cgi-bin/voiweb.exe?g07v_search.asp", fallback)).toBe(
      SharedSystemAdapterKey.GIJIROKUCOM,
    );
  });

  test("g08v_search.asp は gijirokucom", () => {
    expect(detectAdapterKey("https://city.jp/path/G08V_SEARCH.ASP", fallback)).toBe(
      SharedSystemAdapterKey.GIJIROKUCOM,
    );
  });

  test("いずれにも当てはまらない場合は code を返す", () => {
    expect(detectAdapterKey("https://example.jp/minutes", "pref-01")).toBe("pref-01");
  });

  test("discussnet は他パターンより先に判定される", () => {
    expect(detectAdapterKey("https://ssp.kaigiroku.net/tenant/foo/dbsr.jp", fallback)).toBe(
      SharedSystemAdapterKey.DISCUSSNET,
    );
  });
});
