// src/utils/geocodeNominatim.js
import apiClient from "../api/apiClient";

export async function fetchLatLngFromAddress(address) {
  if (!address?.trim()) return null;

  try {
    const response = await apiClient.get("/stores/utils/geocode", {
      params: { q: address },
    });

    const data = response.data;
    const first = Array.isArray(data) ? data[0] : null;
    
    if (!first) return null;

    return {
      lat: first.lat ? Number(first.lat) : null,
      lng: first.lon ? Number(first.lon) : null,
      raw: first,
    };
  } catch (error) {
    console.error("❌ Error fetching coordinates via proxy:", error);
    return null;
  }
}
