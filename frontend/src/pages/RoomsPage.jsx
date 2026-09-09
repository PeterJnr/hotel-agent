import { RoomCard } from "../components/ui/RoomCard.jsx";
import { useRoomTypes } from "../features/rooms/roomQueries.js";

export function RoomsPage() {
  const { data: roomTypes, isPending, error } = useRoomTypes();
  return <><section className="page-hero rooms-hero"><span className="eyebrow light">Rooms & suites</span><h1>Space to exhale.</h1><p>Quietly expressive rooms shaped around rest, privacy, and the rhythm of your stay.</p></section><section className="catalog section">{isPending && <div className="state-card">Preparing your rooms…</div>}{error && <div className="state-card error-state"><strong>We couldn’t load the rooms.</strong><span>{error.message}</span></div>}{roomTypes?.map((roomType, index) => <RoomCard roomType={roomType} key={roomType.id} index={index} />)}</section></>;
}
