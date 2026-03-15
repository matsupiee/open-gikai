import { Card, CardContent } from "@/shared/_components/ui/card";

interface PolicyCategory {
  icon: string;
  label: string;
  sublabel: string;
  keywords: string;
}

const POLICY_CATEGORIES: PolicyCategory[] = [
  {
    icon: "👶",
    label: "子育て・保育",
    sublabel: "保育・待機児童",
    keywords: "保育 待機児童 子育て",
  },
  {
    icon: "🏫",
    label: "教育",
    sublabel: "学校・奨学金",
    keywords: "教育 学校 奨学金",
  },
  {
    icon: "🏥",
    label: "福祉・医療",
    sublabel: "高齢者・障害者",
    keywords: "福祉 医療 高齢者 障害者",
  },
  {
    icon: "🏗",
    label: "インフラ",
    sublabel: "道路・交通",
    keywords: "道路 公共交通 インフラ",
  },
  {
    icon: "🌍",
    label: "環境",
    sublabel: "ごみ・再エネ",
    keywords: "環境 ごみ 再生可能エネルギー",
  },
  {
    icon: "💰",
    label: "財政",
    sublabel: "予算・税収",
    keywords: "財政 予算 税収",
  },
  {
    icon: "🏘",
    label: "住宅・空き家",
    sublabel: "住宅政策",
    keywords: "空き家 住宅 不動産",
  },
  {
    icon: "🛡",
    label: "防災・安全",
    sublabel: "災害・防犯",
    keywords: "防災 災害 防犯 安全",
  },
];

const POPULAR_KEYWORDS = ["待機児童", "給付型奨学金", "空き家", "防災", "DX", "再エネ"];

interface PolicyCategoryBrowserProps {
  onSelectCategory: (keywords: string) => void;
}

export function PolicyCategoryBrowser({ onSelectCategory }: PolicyCategoryBrowserProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-3">政策カテゴリから探す</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {POLICY_CATEGORIES.map((category) => (
            <Card
              key={category.label}
              className="cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => onSelectCategory(category.keywords)}
            >
              <CardContent className="p-4">
                <div className="text-2xl mb-1">{category.icon}</div>
                <p className="text-sm font-medium">{category.label}</p>
                <p className="text-xs text-muted-foreground">{category.sublabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">
          よく検索されるキーワード:
        </h3>
        <div className="flex flex-wrap gap-2">
          {POPULAR_KEYWORDS.map((keyword) => (
            <button
              key={keyword}
              onClick={() => onSelectCategory(keyword)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
