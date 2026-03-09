export type CampusLocation = {
  name: string;
  lat: number;
  lng: number;
};

export const TMU_LOCATIONS: CampusLocation[] = [
  { name: "Main Gate", lat: 28.830960, lng: 78.690230 },
  { name: "Gate 2", lat: 28.832180, lng: 78.692510 },
  { name: "Gate 3", lat: 28.833720, lng: 78.695980 },
  { name: "Administrative Block", lat: 28.831520, lng: 78.694880 },
  { name: "Engineering College", lat: 28.833110, lng: 78.697140 },
  { name: "Medical College", lat: 28.829920, lng: 78.698260 },
  { name: "TMU Hospital", lat: 28.830410, lng: 78.699520 },
  { name: "Dental College", lat: 28.830760, lng: 78.697480 },
  { name: "Pharmacy College", lat: 28.832440, lng: 78.696120 },
  { name: "Library", lat: 28.832010, lng: 78.695430 },
  { name: "Auditorium", lat: 28.831480, lng: 78.696350 },
  { name: "Cafeteria", lat: 28.832760, lng: 78.693980 },
  { name: "Central Park", lat: 28.831830, lng: 78.694320 },
  { name: "Boys Hostel 1", lat: 28.828930, lng: 78.696210 },
  { name: "Boys Hostel 2", lat: 28.828440, lng: 78.697220 },
  { name: "Girls Hostel", lat: 28.829650, lng: 78.695340 },
  { name: "Sports Complex", lat: 28.834020, lng: 78.694670 },
  { name: "Stadium", lat: 28.834720, lng: 78.696110 },
  { name: "Parking Area", lat: 28.831100, lng: 78.692910 },
  { name: "Bus Stop", lat: 28.830630, lng: 78.691120 },
];

export const TMU_CAMPUS_CENTER: [number, number] = [28.831520, 78.695430];
