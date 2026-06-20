// Townsville suburbs with approximate coordinates for mock geocoding.
export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export const TOWNSVILLE_PLACES: Place[] = [
  { name: "Townsville CBD", lat: -19.259, lng: 146.8169 },
  { name: "North Ward", lat: -19.247, lng: 146.805 },
  { name: "Aitkenvale", lat: -19.305, lng: 146.772 },
  { name: "Kirwan", lat: -19.311, lng: 146.729 },
  { name: "Douglas", lat: -19.329, lng: 146.756 },
  { name: "Idalia", lat: -19.296, lng: 146.827 },
  { name: "Mundingburra", lat: -19.291, lng: 146.786 },
  { name: "Cranbrook", lat: -19.299, lng: 146.756 },
  { name: "West End", lat: -19.258, lng: 146.798 },
  { name: "Annandale", lat: -19.31, lng: 146.79 },
];

export const TSV_CENTER = { lat: -19.259, lng: 146.8169 };
