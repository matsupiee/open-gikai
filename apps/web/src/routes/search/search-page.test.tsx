import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

const SEARCH_INPUT_PLACEHOLDER = "検索ワードを入力してください";

const { mockSearchQueryFn, mockMunicipalitiesListQueryFn, mockStorage } = vi.hoisted(() => {
  const store: Record<string, string> = {};
  return {
    mockSearchQueryFn: vi.fn(),
    mockMunicipalitiesListQueryFn: vi.fn(),
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
  createFileRoute: () => () => ({}),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    statements: {
      search: {
        queryOptions: ({ input }: { input: unknown }) => ({
          queryKey: ["statements", "search", input],
          queryFn: mockSearchQueryFn,
        }),
      },
    },
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

/** localStorage から自治体コードが復元されるまで待ってから操作する */
async function renderSearchPageWhenReady() {
  renderSearchPage();
  await waitFor(() => {
    expect(screen.getByPlaceholderText(SEARCH_INPUT_PLACEHOLDER)).toBeTruthy();
  });
}

beforeEach(() => {
  mockSearchQueryFn.mockResolvedValue({ statements: [], nextCursor: null });
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
  it("初期表示: 見出し・自治体セレクター・キーワード検索欄が表示される", async () => {
    await renderSearchPageWhenReady();

    expect(screen.getByRole("heading", { name: "議会答弁調査" })).toBeTruthy();
    expect(screen.getByText("過去の答弁を素早く検索できます")).toBeTruthy();
    expect(screen.getByText("自治体を選択", { exact: false })).toBeTruthy();
    expect(screen.getByPlaceholderText(SEARCH_INPUT_PLACEHOLDER)).toBeTruthy();

    expect(screen.queryByText("質問から探す")).toBeNull();
    expect(screen.queryByText("政策から探す")).toBeNull();
    expect(screen.queryByText("引用リスト")).toBeNull();
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
    mockSearchQueryFn.mockResolvedValue({
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

    expect(screen.getByText("予算について質問します")).toBeTruthy();
    expect(screen.getByText("教育政策について回答します")).toBeTruthy();
    expect(screen.getAllByText("札幌定例会")).toHaveLength(2);
    expect(screen.getByText("質問")).toBeTruthy();
    expect(screen.getByText("答弁")).toBeTruthy();
  });

  it("検索結果なし: メッセージが表示される", async () => {
    const user = userEvent.setup();
    mockSearchQueryFn.mockResolvedValue({ statements: [], nextCursor: null });

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

  it("フィルター表示/非表示: トグルで切り替えできる", async () => {
    const user = userEvent.setup();
    await renderSearchPageWhenReady();

    expect(screen.queryByRole("heading", { name: "フィルター" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "▼ フィルターで絞り込む" }));

    expect(screen.getByRole("heading", { name: "フィルター" })).toBeTruthy();
    expect(screen.getByText("開催日（から）")).toBeTruthy();
    expect(screen.getByText("発言種別")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "▲ フィルターを閉じる" }));

    await waitFor(() => {
      expect(screen.queryByText("開催日（から）")).toBeNull();
    });
  });
});
