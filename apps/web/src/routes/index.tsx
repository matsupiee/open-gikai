import { useState } from "react";

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/shared/_components/ui/button";
import { Card, CardContent } from "@/shared/_components/ui/card";
import { Input } from "@/shared/_components/ui/input";
import { Label } from "@/shared/_components/ui/label";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate({
      to: "/topics",
      search: { q: trimmed },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">議会議事録を議題で探す</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            全国の自治体議会で話し合われた議題から、関連する会議のサマリを横断的に探せます。
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Label htmlFor="landing-topic-query" className="text-sm">
                議題キーワード
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="landing-topic-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例: 市バス事業、子ども医療費助成"
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={!query.trim()} className="sm:w-32">
                  検索
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          発言単位で検索したい場合は{" "}
          <Link to="/search" className="underline hover:text-foreground">
            /search
          </Link>
          {" "}へ
        </div>
      </div>
    </div>
  );
}
