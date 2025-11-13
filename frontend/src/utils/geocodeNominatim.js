// src/utils/geocodeNominatim.js
export async function fetchLatLngFromAddress(address) {
  if (!address?.trim()) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "vi" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.[0];
  if (!first) return null;
  return {
    lat: first.lat ? Number(first.lat) : null,
    lng: first.lon ? Number(first.lon) : null,
    raw: first,
  };
}
