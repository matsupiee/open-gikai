import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
      to: "/chat",
      search: { q: trimmed },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">議会議事録を AI に聞く</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            事業名や議題を入力すると、関連する議事録サマリを横断検索し、議論の流れを時系列でまとめます。
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Label htmlFor="landing-topic-query" className="text-sm">
                調べたい事業・議題
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="landing-topic-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例: 市バス事業、市バス路線再編とICカード事業の関連"
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={!query.trim()} className="sm:w-32">
                  AI に聞く
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
