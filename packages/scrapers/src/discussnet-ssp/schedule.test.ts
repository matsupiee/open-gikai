import { describe, expect, test, vi, afterEach } from "vitest";

// fetch をモックして fetchTenantId をテストする
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { fetchTenantId } from "./schedule";

describe("fetchTenantId", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("形式1: dnp.params.tenant_id = 89 を解析", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("dnp.params.tenant_id = 89"),
    });

    const result = await fetchTenantId("testslug");
    expect(result).toBe(89);
  });

  test("形式2: document.write の value から tenant_id を解析", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `document.write('<input type="hidden" name="tenant_id" value="396">');`
        ),
    });

    const result = await fetchTenantId("testslug");
    expect(result).toBe(396);
  });

  test("形式2: コメント内の例示ではなく最後の出現を使用する", async () => {
    const tenantJs = `/*
 * 記入例：document.write('<input type="hidden" name="tenant_id" value="1234">');
 *         テナントIDが「1234」の場合
 */

document.write('<input type="hidden" name="tenant_id" value="396">');`;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(tenantJs),
    });

    const result = await fetchTenantId("testslug");
    expect(result).toBe(396);
  });

  test("形式1 が形式2 より優先される", async () => {
    const mixed = `dnp.params.tenant_id = 42
document.write('<input type="hidden" name="tenant_id" value="999">');`;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mixed),
    });

    const result = await fetchTenantId("testslug");
    expect(result).toBe(42);
  });

  test("tenantJsUrl を指定した場合はそちらを使用する", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `document.write('<input type="hidden" name="tenant_id" value="570">');`
        ),
    });

    await fetchTenantId(
      "namegawa",
      undefined,
      "https://smart.discussvision.net/smart/tenant/namegawa/WebView/js/tenant.js"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://smart.discussvision.net/smart/tenant/namegawa/WebView/js/tenant.js",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test("host を指定した場合は host ベースの URL を使用する", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("dnp.params.tenant_id = 10"),
    });

    await fetchTenantId("myslug", "https://custom.example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://custom.example.com/tenant/myslug/js/tenant.js",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test("host も tenantJsUrl も未指定の場合はデフォルト SSP_HOST を使用する", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("dnp.params.tenant_id = 10"),
    });

    await fetchTenantId("myslug");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://ssp.kaigiroku.net/tenant/myslug/js/tenant.js",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test("HTTP レスポンスが ok でない場合は null を返す", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const result = await fetchTenantId("testslug");
    expect(result).toBeNull();
  });

  test("tenant_id が見つからない場合は null を返す", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("// no tenant id here"),
    });

    const result = await fetchTenantId("testslug");
    expect(result).toBeNull();
  });

  test("fetch が例外を投げた場合は null を返す", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await fetchTenantId("testslug");
    expect(result).toBeNull();
  });
});
