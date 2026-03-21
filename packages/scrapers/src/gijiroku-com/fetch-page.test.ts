import { describe, expect, test, vi } from "vitest";
import { fetchShiftJisPage, fetchWithHttpFallback } from "./fetch-page";

// Shift_JIS エンコードされた "テスト" のバイト列
const SHIFT_JIS_TEST_BYTES = new Uint8Array([
  0x83, 0x65, 0x83, 0x58, 0x83, 0x67,
]);

function okResponse(body: Uint8Array): Response {
  return new Response(body, { status: 200 });
}

function errorResponse(status: number): Response {
  return new Response(null, { status });
}

describe("fetchShiftJisPage", () => {
  test("正常レスポンスを Shift_JIS デコードして返す", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse(SHIFT_JIS_TEST_BYTES));

    const result = await fetchShiftJisPage(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe?ACT=100",
      mockFetch as typeof globalThis.fetch
    );

    expect(result).toBe("テスト");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("fetch 失敗時は null を返す", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await fetchShiftJisPage(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe?ACT=100",
      mockFetch as typeof globalThis.fetch
    );

    expect(result).toBeNull();
  });
});

describe("fetchWithHttpFallback", () => {
  test("HTTPS で成功した場合、そのままレスポンスを返す", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse(SHIFT_JIS_TEST_BYTES));

    const res = await fetchWithHttpFallback(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe",
      mockFetch as typeof globalThis.fetch
    );

    expect(res).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test("HTTPS で接続エラーの場合、HTTP にフォールバックする", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(okResponse(SHIFT_JIS_TEST_BYTES));

    const res = await fetchWithHttpFallback(
      "https://fujieda.gijiroku.com/voices/cgi/voiweb.exe",
      mockFetch as typeof globalThis.fetch
    );

    expect(res).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://fujieda.gijiroku.com/voices/cgi/voiweb.exe",
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "http://fujieda.gijiroku.com/voices/cgi/voiweb.exe",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test("HTTP URL で接続エラーの場合、フォールバックせず null を返す", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await fetchWithHttpFallback(
      "http://example.com/voices/cgi/voiweb.exe",
      mockFetch as typeof globalThis.fetch
    );

    expect(res).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("HTTPS・HTTP 両方で接続エラーの場合、null を返す", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await fetchWithHttpFallback(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe",
      mockFetch as typeof globalThis.fetch
    );

    expect(res).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("非 OK ステータスの場合、null を返す", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500));

    const res = await fetchWithHttpFallback(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe",
      mockFetch as typeof globalThis.fetch
    );

    expect(res).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("HTTPS で非 OK、フォールバックはしない（接続エラーのみフォールバック）", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(403));

    const res = await fetchWithHttpFallback(
      "https://example.gijiroku.com/voices/cgi/voiweb.exe",
      mockFetch as typeof globalThis.fetch
    );

    expect(res).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
