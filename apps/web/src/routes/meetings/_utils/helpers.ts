import type { Meeting } from "../_hooks/useMeetings";

export const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case "pending": return "bg-gray-500 text-white";
    case "processing": return "bg-blue-500 text-white";
    case "done": return "bg-green-500 text-white";
    case "failed": return "bg-red-500 text-white";
    default: return "bg-gray-500 text-white";
  }
};

export const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("ja-JP");

export const getLocationText = (meeting: Meeting): string => {
  if (meeting.assembly_level === "national") return "国会";
  if (meeting.prefecture && meeting.municipality) {
    return `${meeting.prefecture}/${meeting.municipality}`;
  }
  return meeting.prefecture || "未定義";
};
