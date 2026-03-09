export const getKindLabel = (kind: string): string => {
  const kindMap: Record<string, string> = {
    question: "質問",
    answer: "答弁",
    remark: "発言",
    unknown: "不明",
  };
  return kindMap[kind] || "不明";
};

export const getKindColor = (kind: string): string => {
  const colorMap: Record<string, string> = {
    question: "bg-blue-100 text-blue-800",
    answer: "bg-green-100 text-green-800",
    remark: "bg-yellow-100 text-yellow-800",
    unknown: "bg-gray-100 text-gray-800",
  };
  return colorMap[kind] || "bg-gray-100 text-gray-800";
};
