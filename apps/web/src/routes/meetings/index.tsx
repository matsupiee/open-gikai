import { createFileRoute } from "@tanstack/react-router";

import { FilterForm } from "./_components/filter-form";
import { MeetingsTable } from "./_components/meetings-table";
import { useMeetings } from "./_hooks/useMeetings";

export const Route = createFileRoute("/meetings/")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
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
    nextCursor,
    handleSearch,
    handleLoadMore,
    handleReset,
  } = useMeetings();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">議事録ブラウザ</h1>

        <FilterForm
          assemblyLevel={assemblyLevel}
          setAssemblyLevel={setAssemblyLevel}
          prefecture={prefecture}
          setPrefecture={setPrefecture}
          municipality={municipality}
          setMunicipality={setMunicipality}
          heldOnFrom={heldOnFrom}
          setHeldOnFrom={setHeldOnFrom}
          heldOnTo={heldOnTo}
          setHeldOnTo={setHeldOnTo}
          onSearch={handleSearch}
          onReset={handleReset}
        />

        <MeetingsTable
          meetings={allMeetings}
          isFetching={isFetching}
          nextCursor={nextCursor}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}
