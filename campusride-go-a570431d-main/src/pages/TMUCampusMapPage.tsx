import PageTransition from "@/components/PageTransition";
import TMUCampusMap from "@/components/map/TMUCampusMap";
import { TMU_LOCATIONS } from "@/lib/tmuLocations";

export default function TMUCampusMapPage() {
  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-4 space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">TMU Campus Map</h1>
          <p className="text-sm text-slate-600">
            Dynamic Leaflet map with {TMU_LOCATIONS.length} campus locations and auto-fit marker bounds.
          </p>
        </header>

        <TMUCampusMap locations={TMU_LOCATIONS} />
      </main>
    </PageTransition>
  );
}
