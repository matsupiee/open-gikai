import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/_components/ui/accordion";
import { Badge } from "@/shared/_components/ui/badge";

interface SubCategory {
  label: string;
  keywords: string;
}

interface PolicyCategory {
  icon: string;
  label: string;
  subcategories: SubCategory[];
}

const POLICY_CATEGORIES: PolicyCategory[] = [
  {
    icon: "👶",
    label: "子育て・教育",
    subcategories: [
      { label: "子育て支援課", keywords: "子育て支援 児童手当 子ども" },
      { label: "保育課", keywords: "保育 待機児童 保育所 認可保育" },
      { label: "教育総務課", keywords: "教育委員会 学校 通学 教育行政" },
      { label: "学校教育課", keywords: "給食 奨学金 ICT教育 学力" },
      { label: "青少年課", keywords: "青少年 放課後 児童館 若者支援" },
    ],
  },
  {
    icon: "🏥",
    label: "健康・福祉",
    subcategories: [
      { label: "高齢者福祉課", keywords: "介護 高齢者 認知症 地域包括" },
      { label: "障害福祉課", keywords: "障害者 障害児 バリアフリー 障害福祉" },
      { label: "健康推進課", keywords: "健康診断 予防接種 感染症 健康づくり" },
      { label: "生活支援課", keywords: "生活保護 生活困窮 自立支援" },
      { label: "国民健康保険課", keywords: "国保 国民健康保険 医療費" },
    ],
  },
  {
    icon: "🏗",
    label: "まちづくり・インフラ",
    subcategories: [
      { label: "都市計画課", keywords: "都市計画 区画整理 景観 まちづくり" },
      { label: "道路課", keywords: "道路 橋梁 歩道 道路整備" },
      { label: "交通政策課", keywords: "公共交通 バス 交通 デマンド交通" },
      { label: "建築課", keywords: "建築 耐震 建築基準" },
      { label: "住宅課", keywords: "住宅 公営住宅 空き家 住宅政策" },
      { label: "上下水道課", keywords: "上水道 下水道 水道 浄水" },
      { label: "公園緑地課", keywords: "公園 緑地 遊具 広場" },
    ],
  },
  {
    icon: "🌍",
    label: "環境・衛生",
    subcategories: [
      { label: "環境政策課", keywords: "環境 脱炭素 再生可能エネルギー カーボンニュートラル" },
      { label: "廃棄物対策課", keywords: "ごみ リサイクル 廃棄物 分別" },
      { label: "環境保全課", keywords: "大気 水質 騒音 環境汚染" },
    ],
  },
  {
    icon: "🌾",
    label: "産業・観光・雇用",
    subcategories: [
      { label: "商工振興課", keywords: "商工 中小企業 商店街 起業" },
      { label: "農政課", keywords: "農業 農地 担い手 耕作放棄地" },
      { label: "林務課", keywords: "林業 森林 木材 林道" },
      { label: "水産課", keywords: "水産 漁業 漁港 養殖" },
      { label: "観光課", keywords: "観光 誘客 観光振興 インバウンド" },
      { label: "雇用対策課", keywords: "雇用 就労 労働 人材確保" },
    ],
  },
  {
    icon: "💰",
    label: "総務・財政・行政",
    subcategories: [
      { label: "財政課", keywords: "財政 予算 決算 税収" },
      { label: "総務課", keywords: "行政改革 条例 庁舎 行政運営" },
      { label: "デジタル推進課", keywords: "DX デジタル化 マイナンバー オンライン" },
      { label: "人事課", keywords: "職員 人事 働き方改革 定員管理" },
      { label: "税務課", keywords: "税金 固定資産税 住民税 徴収" },
      { label: "企画政策課", keywords: "総合計画 人口減少 地方創生 広域連携" },
    ],
  },
  {
    icon: "🛡",
    label: "防災・消防・安全",
    subcategories: [
      { label: "防災課", keywords: "防災 災害 避難 ハザードマップ" },
      { label: "消防本部", keywords: "消防 救急 救命 消防団" },
      { label: "交通安全課", keywords: "交通安全 通学路 防犯 見守り" },
    ],
  },
  {
    icon: "🏠",
    label: "市民生活・人権",
    subcategories: [
      { label: "市民課", keywords: "戸籍 届出 窓口 住民票" },
      { label: "人権推進課", keywords: "人権 男女共同参画 多文化共生 ダイバーシティ" },
      { label: "地域振興課", keywords: "自治会 町内会 コミュニティ 地域活動" },
      { label: "文化スポーツ課", keywords: "文化 スポーツ 図書館 生涯学習" },
    ],
  },
  {
    icon: "🏛",
    label: "議会・選挙",
    subcategories: [
      { label: "議会事務局", keywords: "議会 議員 委員会 議会改革" },
      { label: "選挙管理委員会", keywords: "選挙 投票 投票率 期日前投票" },
    ],
  },
];

const POPULAR_KEYWORDS = [
  "待機児童",
  "給付型奨学金",
  "空き家",
  "防災",
  "DX",
  "再エネ",
  "公共交通",
  "人口減少",
  "介護",
  "脱炭素",
];

interface PolicyCategoryBrowserProps {
  onSelectCategory: (keywords: string) => void;
}

export function PolicyCategoryBrowser({ onSelectCategory }: PolicyCategoryBrowserProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-3">政策カテゴリから探す</h2>
        <p className="text-xs text-muted-foreground mb-4">
          担当課の分野をクリックすると、関連する議会答弁を検索できます
        </p>
        <Accordion type="multiple" className="rounded-md border border-border bg-card">
          {POLICY_CATEGORIES.map((category) => (
            <AccordionItem key={category.label} value={category.label}>
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <span className="text-sm font-medium">{category.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ({category.subcategories.length})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="flex flex-wrap gap-2">
                  {category.subcategories.map((sub) => (
                    <Badge
                      key={sub.label}
                      variant="outline"
                      className="cursor-pointer px-3 py-1.5 text-xs hover:bg-primary/10 hover:border-primary/50 transition-colors"
                      onClick={() => onSelectCategory(sub.keywords)}
                    >
                      {sub.label}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
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
