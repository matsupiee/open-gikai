import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchTenantId, fetchCouncils, fetchSchedules } from "./schedule";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );

// --- fetchTenantId 実データテスト ---

describe("fetchTenantId with real fixtures", () => {
  afterEach(() => vi.restoreAllMocks());

  test("saas: dnp.params.tenant_id 形式から取得", async () => {
    const tenantJs = fixture("saas", "tenant.js");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(tenantJs),
      }),
    );

    const tenantId = await fetchTenantId("hakodate");
    expect(tenantId).toBe(537);
  });

  test("self-hosted: dnp.params.tenant_id 形式 + カスタムホストから取得", async () => {
    const tenantJs = fixture("self-hosted", "tenant.js");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(tenantJs),
      }),
    );

    const tenantId = await fetchTenantId(
      "yokohama",
      "http://giji.city.yokohama.lg.jp",
    );
    expect(tenantId).toBe(20);
  });

  test("smart: document.write 形式の tenant_id value から取得", async () => {
    const tenantJs = fixture("smart", "tenant.js");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(tenantJs),
      }),
    );

    const tenantId = await fetchTenantId("kahoku", undefined, "https://smart.discussvision.net/smart/tenant/kahoku/WebView/js/tenant.js");
    expect(tenantId).toBe(396);
  });
});

// --- fetchCouncils 実データテスト ---

describe("fetchCouncils with real fixtures", () => {
  afterEach(() => vi.restoreAllMocks());

  test("saas: 2024年の会議一覧を取得", async () => {
    const councilsJson = JSON.parse(fixture("saas", "councils.json"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(councilsJson),
      }),
    );

    const councils = await fetchCouncils(537, 2024);
    expect(councils.length).toBeGreaterThan(0);
    expect(councils[0]!.councilId).toBe(1251);
    expect(councils[0]!.name).toBe("令和　6年第1回　2月定例会");
    expect(councils[0]!.viewYear).toBe("2024");
  });

  test("self-hosted: カスタム apiBase で 2024年の会議一覧を取得", async () => {
    const councilsJson = JSON.parse(fixture("self-hosted", "councils.json"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(councilsJson),
      }),
    );

    const councils = await fetchCouncils(
      20,
      2024,
      "http://giji.city.yokohama.lg.jp/dnp/search",
    );
    expect(councils.length).toBeGreaterThan(0);
    expect(councils[0]!.councilId).toBe(979);
    expect(councils[0]!.name).toBe("令和　6年第4回定例会");
    expect(councils[0]!.viewYear).toBe("2024");
  });

  test("smart: 2024年の会議一覧を取得", async () => {
    const councilsJson = JSON.parse(fixture("smart", "councils.json"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(councilsJson),
      }),
    );

    const councils = await fetchCouncils(396, 2024);
    expect(councils.length).toBeGreaterThan(0);
    expect(councils[0]!.councilId).toBe(562);
    expect(councils[0]!.name).toBe("令和　6年　定例会緊急議会（12月）");
    expect(councils[0]!.viewYear).toBe("2024");
  });
});

// --- fetchSchedules 実データテスト ---

describe("fetchSchedules with real fixtures", () => {
  afterEach(() => vi.restoreAllMocks());

  test("saas: スケジュール一覧を取得", async () => {
    const schedulesJson = JSON.parse(fixture("saas", "schedules.json"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(schedulesJson),
      }),
    );

    const schedules = await fetchSchedules(537, 1251);
    expect(schedules).toHaveLength(7);
    expect(schedules[0]!.scheduleId).toBe(2);
    expect(schedules[0]!.name).toBe("02月22日－01号");
    expect(schedules[0]!.memberList).toContain("令和６年２月２２日");
  });

  test("self-hosted: カスタム apiBase でスケジュール一覧を取得", async () => {
    const schedulesJson = JSON.parse(fixture("self-hosted", "schedules.json"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(schedulesJson),
      }),
    );

    const schedules = await fetchSchedules(
      20,
      979,
      "http://giji.city.yokohama.lg.jp/dnp/search",
    );
    expect(schedules).toHaveLength(4);
    expect(schedules[0]!.scheduleId).toBe(2);
    expect(schedules[0]!.name).toBe("11月29日－16号");
    expect(schedules[0]!.memberList).toContain("令和６年11月29日");
  });

  test("smart: スケジュール一覧を取得", async () => {
    const schedulesJson = JSON.parse(fixture("smart", "schedules.json"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(schedulesJson),
      }),
    );

    const schedules = await fetchSchedules(396, 562);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.scheduleId).toBe(2);
    expect(schedules[0]!.name).toBe("12月27日－01号");
    expect(schedules[0]!.memberList).toContain("令和６年１２月２７日");
  });
});

// --- adapter.fetchList 統合テスト ---

describe("adapter.fetchList integration", () => {
  afterEach(() => vi.restoreAllMocks());

  test("saas: テナント取得 → 会議一覧 → スケジュール一覧の完全フロー", async () => {
    const tenantJs = fixture("saas", "tenant.js");
    const councilsJson = JSON.parse(fixture("saas", "councils.json"));
    const schedulesJson = JSON.parse(fixture("saas", "schedules.json"));

    const mockFetch = vi.fn();
    // 1st: GET tenant.js
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tenantJs),
    });
    // 2nd: POST councils/index
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(councilsJson),
    });
    // 3rd+: POST minutes/get_schedule (1回目の council のみレスポンスあり、残りは空)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(schedulesJson),
    });
    // 残りの council は空スケジュール
    for (let i = 0; i < 60; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ council_schedules: [] }),
      });
    }
    vi.stubGlobal("fetch", mockFetch);

    // adapter をインポートして fetchList を呼ぶ
    const { adapter } = await import("./index");
    const records = await adapter.fetchList({
      baseUrl:
        "https://ssp.kaigiroku.net/tenant/hakodate/SpMinuteSearch.html",
      year: 2024,
    });

    // 最初の council のスケジュール 7 件が ListRecord になる
    expect(records.length).toBeGreaterThanOrEqual(7);
    expect(records[0]!.detailParams.tenantId).toBe(537);
    expect(records[0]!.detailParams.tenantSlug).toBe("hakodate");
    expect(records[0]!.detailParams.councilId).toBe(1251);
    expect(records[0]!.detailParams.scheduleName).toBe("02月22日－01号");
  });

  test("self-hosted: カスタムホストで完全フロー", async () => {
    const tenantJs = fixture("self-hosted", "tenant.js");
    const councilsJson = JSON.parse(fixture("self-hosted", "councils.json"));
    const schedulesJson = JSON.parse(
      fixture("self-hosted", "schedules.json"),
    );

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tenantJs),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(councilsJson),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(schedulesJson),
    });
    for (let i = 0; i < 40; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ council_schedules: [] }),
      });
    }
    vi.stubGlobal("fetch", mockFetch);

    const { adapter } = await import("./index");
    const records = await adapter.fetchList({
      baseUrl:
        "http://giji.city.yokohama.lg.jp/tenant/yokohama/MinuteSearch.html?tab=detail",
      year: 2024,
    });

    expect(records.length).toBeGreaterThanOrEqual(4);
    expect(records[0]!.detailParams.tenantId).toBe(20);
    expect(records[0]!.detailParams.tenantSlug).toBe("yokohama");
    expect(records[0]!.detailParams.host).toBe(
      "http://giji.city.yokohama.lg.jp",
    );
    expect(records[0]!.detailParams.apiBase).toBe(
      "http://giji.city.yokohama.lg.jp/dnp/search",
    );
  });

  test("smart: discussvision.net で完全フロー", async () => {
    const tenantJs = fixture("smart", "tenant.js");
    const councilsJson = JSON.parse(fixture("smart", "councils.json"));
    const schedulesJson = JSON.parse(fixture("smart", "schedules.json"));

    const mockFetch = vi.fn();
    // 1st: GET tenant.js (initial attempt with SSP_HOST → fails or no match)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve(""),
    });
    // 2nd: GET tenant.js (retry with baseUrl-derived URL)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tenantJs),
    });
    // 3rd: POST councils/index
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(councilsJson),
    });
    // 4th: POST minutes/get_schedule
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(schedulesJson),
    });
    for (let i = 0; i < 30; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ council_schedules: [] }),
      });
    }
    vi.stubGlobal("fetch", mockFetch);

    const { adapter } = await import("./index");
    const records = await adapter.fetchList({
      baseUrl:
        "https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/council_1.html",
      year: 2024,
    });

    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0]!.detailParams.tenantId).toBe(396);
    expect(records[0]!.detailParams.tenantSlug).toBe("kahoku");
  });
});
