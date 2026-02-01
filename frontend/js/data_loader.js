const cache = new Map();

export async function fetchCountryData(isoCode) {
  const code = (isoCode || "").toUpperCase();
  if (!code || code === "-99") {
    return null;
  }

  if (cache.has(code)) {
    return cache.get(code);
  }

  try {
    const response = await fetch(`/api/country/${code}`);
    if (!response.ok) {
      cache.set(code, null);
      return null;
    }
    const data = await response.json();
    cache.set(code, data);
    return data;
  } catch (error) {
    return null;
  }
}

export function clearCountryCache() {
  cache.clear();
}
