import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

const SEARCH_INPUT_PLACEHOLDER = "検索ワードを入力してください";

const { mockSearchFn, mockMunicipalitiesListQueryFn, mockStorage, mockNavigate, searchParamsRef } =
  vi.hoisted(() => {
    const store: Record<string, string> = {};
    return {
      mockSearchFn: vi.fn(),
      mockMunicipalitiesListQueryFn: vi.fn(),
      mockNavigate: vi.fn(),
      searchParamsRef: { current: {} as Record<string, unknown> },
      mockStorage: {
        store,
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          for (const k in store) delete store[k];
        }),
      },
    };
  });

Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true });

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => searchParamsRef.current,
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/orpc/orpc", () => ({
  client: {
    statements: {
      search: mockSearchFn,
    },
  },
  orpc: {
    municipalities: {
      list: {
        queryOptions: ({ input }: { input: unknown }) => ({
          queryKey: ["municipalities", "list", input],
          queryFn: mockMunicipalitiesListQueryFn,
        }),
      },
    },
  },
}));

import { MUNICIPALITY_CODES_STORAGE_KEY } from "./_hooks/usePersistedMunicipalityCodes";
import { RouteComponent } from "./index";

function renderSearchPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouteComponent />
    </QueryClientProvider>,
  );
}

async function renderSearchPageWhenReady() {
  renderSearchPage();
  await waitFor(() => {
    expect(screen.getByPlaceholderText(SEARCH_INPUT_PLACEHOLDER)).toBeTruthy();
  });
}

beforeEach(() => {
  searchParamsRef.current = {};
  mockNavigate.mockClear();
  mockSearchFn.mockResolvedValue({ statements: [], nextCursor: null });
  mockMunicipalitiesListQueryFn.mockResolvedValue({
    municipalities: [
      {
        code: "010001",
        name: "札幌市",
        prefecture: "北海道",
        baseUrl: null,
        population: null,
        meetingCount: 0,
        systemTypeDescription: null,
      },
    ],
    total: 1,
  });
  mockStorage.store[MUNICIPALITY_CODES_STORAGE_KEY] = JSON.stringify(["010001"]);
});

describe("検索ページ", () => {
  it("初期表示: 見出し・自治体セレクター・キーワード検索欄・フィルターが表示される", async () => {
    await renderSearchPageWhenReady();

    expect(screen.getByRole("heading", { name: "議会答弁調査" })).toBeTruthy();
    expect(screen.getByText("過去の答弁を素早く検索できます")).toBeTruthy();
    expect(screen.getByText("自治体を選択", { exact: false })).toBeTruthy();
    expect(screen.getByPlaceholderText(SEARCH_INPUT_PLACEHOLDER)).toBeTruthy();

    // 詳細条件トグルが表示される
    expect(screen.getByRole("button", { name: /詳細条件/ })).toBeTruthy();
  });

  it("自治体未選択時は検索フォームの代わりに案内が表示される", async () => {
    delete mockStorage.store[MUNICIPALITY_CODES_STORAGE_KEY];
    renderSearchPage();

    await waitFor(() => {
      expect(
        screen.getByText("上のセレクターから自治体を選択すると、検索が可能になります"),
      ).toBeTruthy();
    });
    expect(screen.queryByPlaceholderText(SEARCH_INPUT_PLACEHOLDER)).toBeNull();
  });

  it("キーワード検索: 入力のデバウンス後に結果が表示される", async () => {
    const user = userEvent.setup();
    mockSearchFn.mockResolvedValue({
      statements: [
        {
          id: "stmt-1",
          meetingId: "meeting-1",
          kind: "question",
          speakerName: "田中太郎",
          content: "予算について質問します",
          createdAt: new Date("2024-03-01"),
          meetingTitle: "札幌定例会",
          heldOn: "2024-03-01",
          prefecture: "北海道",
          municipality: "札幌市",
          sourceUrl: "https://example.com/sapporo",
        },
        {
          id: "stmt-2",
          meetingId: "meeting-1",
          kind: "answer",
          speakerName: "市長",
          content: "教育政策について回答します",
          createdAt: new Date("2024-03-01"),
          meetingTitle: "札幌定例会",
          heldOn: "2024-03-01",
          prefecture: "北海道",
          municipality: "札幌市",
          sourceUrl: null,
        },
      ],
      nextCursor: null,
    });

    await renderSearchPageWhenReady();

    const input = screen.getByPlaceholderText(SEARCH_INPUT_PLACEHOLDER);
    await user.type(input, "予算");

    await waitFor(
      () => {
        expect(screen.getByText("2件の結果")).toBeTruthy();
      },
      { timeout: 3000 },
    );

    expect(
      screen.getByText((_, element) => element?.textContent === "予算について質問します"),
    ).toBeTruthy();
    expect(screen.getByText("教育政策について回答します")).toBeTruthy();
    expect(screen.getAllByText("札幌定例会")).toHaveLength(2);
    expect(screen.getAllByText("質問").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("答弁").length).toBeGreaterThanOrEqual(1);
  });

  it("検索結果なし: メッセージが表示される", async () => {
    const user = userEvent.setup();
    mockSearchFn.mockResolvedValue({ statements: [], nextCursor: null });

    await renderSearchPageWhenReady();

    const input = screen.getByPlaceholderText(SEARCH_INPUT_PLACEHOLDER);
    await user.type(input, "存在しないキーワード");

    await waitFor(
      () => {
        expect(screen.getByText("発言が見つかりませんでした")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it("日付バリデーション: 開始日が終了日より後の場合エラーが表示される", async () => {
    // URL パラメータで不正な日付範囲を指定した状態で初期化
    searchParamsRef.current = { q: "テスト", heldOnFrom: "2024-06-01", heldOnTo: "2024-01-01" };

    await renderSearchPageWhenReady();

    expect(screen.getByText("開始日は終了日より前の日付を指定してください")).toBeTruthy();
  });
});
