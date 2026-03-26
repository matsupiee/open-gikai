import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSearchQueryFn, mockSemanticQueryFn } = vi.hoisted(() => ({
  mockSearchQueryFn: vi.fn(),
  mockSemanticQueryFn: vi.fn(),
}));

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
      semanticSearch: {
        queryOptions: ({ input }: { input: unknown }) => ({
          queryKey: ["statements", "semanticSearch", input],
          queryFn: mockSemanticQueryFn,
        }),
      },
    },
  },
}));

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

beforeEach(() => {
  mockSearchQueryFn.mockResolvedValue({ statements: [], nextCursor: null });
  mockSemanticQueryFn.mockResolvedValue({ statements: [] });
});

describe("検索ページ", () => {
  it("初期表示: 見出し・モード切替・検索入力・引用パネルが表示される", () => {
    renderSearchPage();

    expect(screen.getByText("議会答弁調査")).toBeDefined();
    expect(screen.getByText("質問から探す")).toBeDefined();
    expect(screen.getByText("政策から探す")).toBeDefined();
    expect(
      screen.getByPlaceholderText(
        "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
      ),
    ).toBeDefined();
    expect(screen.getByText("引用リスト")).toBeDefined();
    expect(
      screen.getByText("答弁カードの「引用する」ボタンで根拠を追加できます"),
    ).toBeDefined();
  });

  it("政策モード: PolicyCategoryBrowser が表示される", async () => {
    const user = userEvent.setup();
    renderSearchPage();

    await user.click(screen.getByText("政策から探す"));

    expect(screen.getByText("政策カテゴリから探す")).toBeDefined();
    expect(screen.getByText("子育て・教育")).toBeDefined();
    expect(screen.getByText("健康・福祉")).toBeDefined();
    expect(screen.getByText("よく検索されるキーワード:")).toBeDefined();
    expect(screen.getByText("待機児童")).toBeDefined();
  });

  it("キーワード検索: 結果が表示される", async () => {
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

    renderSearchPage();

    // 政策モードに切り替え（キーワード検索）
    await user.click(screen.getByText("政策から探す"));
    // 人気キーワードをクリックして検索実行
    await user.click(screen.getByText("待機児童"));

    await waitFor(() => {
      expect(screen.getByText("2件の結果")).toBeDefined();
    });

    expect(screen.getByText("予算について質問します")).toBeDefined();
    expect(screen.getByText("教育政策について回答します")).toBeDefined();
    expect(screen.getAllByText("札幌定例会")).toHaveLength(2);
    expect(screen.getByText("質問")).toBeDefined();
    expect(screen.getByText("答弁")).toBeDefined();
  });

  it("セマンティック検索: 類似度付きで結果が表示される", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({
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
          sourceUrl: null,
          similarity: 0.85,
        },
      ],
    });

    renderSearchPage();

    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "待機児童対策について");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("1件の結果")).toBeDefined();
    });

    expect(screen.getByText("予算について質問します")).toBeDefined();
    expect(screen.getByText("類似度: 85%")).toBeDefined();
  });

  it("検索結果なし: メッセージが表示される", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({ statements: [] });

    renderSearchPage();

    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "存在しないキーワード");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("発言が見つかりませんでした")).toBeDefined();
    });
  });

  it("引用ワークフロー: 引用する → 引用パネルに表示 → ボタンが引用済みに変化", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({
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
          sourceUrl: null,
          similarity: 0.5,
        },
        {
          id: "stmt-2",
          meetingId: "meeting-2",
          kind: "answer",
          speakerName: "市長",
          content: "教育政策について回答します",
          createdAt: new Date("2024-06-01"),
          meetingTitle: "千代田定例会",
          heldOn: "2024-06-01",
          prefecture: "東京都",
          municipality: "千代田区",
          sourceUrl: null,
          similarity: 0.4,
        },
      ],
    });

    renderSearchPage();

    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "予算");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("2件の結果")).toBeDefined();
    });

    // 1件目を引用
    const citeButtons = screen.getAllByText("引用する");
    await user.click(citeButtons[0]!);

    expect(screen.getByText("引用リスト（1件）")).toBeDefined();
    expect(screen.getByText("引用済み")).toBeDefined();

    // 2件目も引用
    const remainingCiteButton = screen.getByText("引用する");
    await user.click(remainingCiteButton);

    expect(screen.getByText("引用リスト（2件）")).toBeDefined();
  });

  it("引用削除: × ボタンで引用を削除できる", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({
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
          sourceUrl: null,
          similarity: 0.5,
        },
      ],
    });

    renderSearchPage();

    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "予算");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("1件の結果")).toBeDefined();
    });

    await user.click(screen.getByText("引用する"));
    expect(screen.getByText("引用リスト（1件）")).toBeDefined();

    // × ボタンで削除
    await user.click(screen.getByText("×"));
    expect(
      screen.getByText("答弁カードの「引用する」ボタンで根拠を追加できます"),
    ).toBeDefined();
  });

  it("引用クリア: クリアボタンで全引用を削除できる", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({
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
          sourceUrl: null,
          similarity: 0.5,
        },
      ],
    });

    renderSearchPage();

    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "予算");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("1件の結果")).toBeDefined();
    });

    await user.click(screen.getByText("引用する"));
    expect(screen.getByText("引用リスト（1件）")).toBeDefined();

    await user.click(screen.getByText("クリア"));
    expect(
      screen.getByText("答弁カードの「引用する」ボタンで根拠を追加できます"),
    ).toBeDefined();
  });

  it("モード切替: 質問→政策に切り替えると状態がリセットされる", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({
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
          sourceUrl: null,
          similarity: 0.5,
        },
      ],
    });

    renderSearchPage();

    // 質問モードで検索
    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "予算");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("1件の結果")).toBeDefined();
    });

    // 政策モードに切り替え
    await user.click(screen.getByText("政策から探す"));

    // 結果がリセットされ、PolicyCategoryBrowser が表示される
    expect(screen.queryByText("1件の結果")).toBeNull();
    expect(screen.getByText("政策カテゴリから探す")).toBeDefined();
  });

  it("フィルター表示/非表示: トグルで切り替えできる", async () => {
    const user = userEvent.setup();
    renderSearchPage();

    expect(screen.queryByText("フィルター")).toBeNull();

    await user.click(screen.getByText("▼ フィルターで絞り込む"));

    expect(screen.getByText("フィルター")).toBeDefined();
    expect(screen.getByText("開催日（から）")).toBeDefined();
    expect(screen.getByText("発言種別")).toBeDefined();
    expect(screen.getByText("都道府県名")).toBeDefined();

    await user.click(screen.getByText("▲ フィルターを閉じる"));

    expect(screen.queryByText("開催日（から）")).toBeNull();
  });

  it("回答案作成: 引用後に回答案ワークスペースを開ける", async () => {
    const user = userEvent.setup();
    mockSemanticQueryFn.mockResolvedValue({
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
          sourceUrl: null,
          similarity: 0.5,
        },
      ],
    });

    renderSearchPage();

    const input = screen.getByPlaceholderText(
      "例: 「待機児童対策の現状と今後の方針は？」と入力してください",
    );
    await user.type(input, "予算");
    await user.click(screen.getByText("過去答弁を検索"));

    await waitFor(() => {
      expect(screen.getByText("1件の結果")).toBeDefined();
    });

    await user.click(screen.getByText("引用する"));
    await user.click(screen.getByText("回答案を作成"));

    expect(screen.getByText("STEP 3: 回答案の作成")).toBeDefined();
    expect(screen.getByText("引用した根拠")).toBeDefined();
    expect(screen.getByText("引用付きでコピー")).toBeDefined();
  });
});
