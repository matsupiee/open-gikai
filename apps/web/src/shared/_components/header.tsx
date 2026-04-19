import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import UserMenu from "./user-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { FileSearch, Menu } from "lucide-react";

const links = [
  { to: "/meetings", label: "会議一覧" },
] as const;

function NavLink({
  to,
  isActive,
  children,
  onClick,
}: {
  to: string;
  isActive: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Header() {
  const { location } = useRouterState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <FileSearch className="h-8 w-8" />
          </Link>
          <nav className="hidden min-[481px]:flex items-center gap-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                isActive={location.pathname.startsWith(to)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-[481px]:hidden rounded-md p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">メニューを開く</span>
          </button>
          <UserMenu />
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>メニュー</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                isActive={location.pathname.startsWith(to)}
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
