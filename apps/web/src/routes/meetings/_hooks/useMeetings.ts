import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  held_on: string;
  source_url: string | null;
  assembly_level: string;
  prefecture: string | null;
  municipality: string | null;
  external_id: string | null;
  raw_text: string;
  status: string;
  scraped_at: Date | null;
  created_at: Date;
  statementsCount: number;
}

export function useMeetings() {
  const [assemblyLevel, setAssemblyLevel] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [heldOnFrom, setHeldOnFrom] = useState("");
  const [heldOnTo, setHeldOnTo] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);

  const filterParams = {
    assemblyLevel: (assemblyLevel || undefined) as "national" | "prefectural" | "municipal" | undefined,
    prefecture: prefecture || undefined,
    municipality: municipality || undefined,
    heldOnFrom: heldOnFrom || undefined,
    heldOnTo: heldOnTo || undefined,
    cursor,
    limit: 20,
  };

  const { data, isFetching, refetch } = useQuery(
    orpc.meetings.list.queryOptions({ input: filterParams })
  );

  useEffect(() => {
    if (data?.meetings) {
      if (!cursor) {
        setAllMeetings(data.meetings);
      } else {
        setAllMeetings((prev) => [...prev, ...data.meetings]);
      }
    }
  }, [data?.meetings, cursor]);

  const handleSearch = () => {
    setAllMeetings([]);
    setCursor(undefined);
    refetch();
  };

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  const handleReset = () => {
    setAssemblyLevel("");
    setPrefecture("");
    setMunicipality("");
    setHeldOnFrom("");
    setHeldOnTo("");
    setAllMeetings([]);
    setCursor(undefined);
    refetch();
  };

  return {
    assemblyLevel,
    setAssemblyLevel,
    prefecture,
    setPrefecture,
    municipality,
    setMunicipality,
    heldOnFrom,
    setHeldOnFrom,
    heldOnTo,
    setHeldOnTo,
    allMeetings,
    isFetching,
    nextCursor: data?.nextCursor ?? undefined,
    handleSearch,
    handleLoadMore,
    handleReset,
  };
}
