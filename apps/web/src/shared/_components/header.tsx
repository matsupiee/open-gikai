import { Link, useRouterState } from "@tanstack/react-router";

import UserMenu from "./user-menu";
import { FileSearch } from "lucide-react";

const links = [
  { to: "/search", label: "答弁検索" },
  { to: "/meetings", label: "会議一覧" },
  { to: "/municipalities", label: "自治体一覧" },
] as const;

export default function Header() {
  const { location } = useRouterState();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <FileSearch className="h-8 w-8" />
          </Link>
          <nav className="flex items-center gap-1">
            {links.map(({ to, label }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
