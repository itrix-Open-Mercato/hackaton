export interface GeocodingResult {
  latitude: number
  longitude: number
  normalizedAddress: string
}

export interface GeocodingAdapter {
  geocode(address: string): Promise<GeocodingResult | null>
}

const GEOCODING_TIMEOUT_MS = 500

/**
 * Calls the Google Geocoding API using the GOOGLE_MAPS_API_KEY env var.
 * All error cases (ZERO_RESULTS, OVER_QUERY_LIMIT, REQUEST_DENIED, network)
 * return null — ticket saves must never fail due to geocoding.
 */
export class GoogleGeocodingAdapter implements GeocodingAdapter {
  private readonly apiKey: string

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY ?? ''
    if (!this.apiKey) {
      console.warn('[geocoding] GOOGLE_MAPS_API_KEY is not set — geocoding disabled')
    }
  }

  async geocode(address: string): Promise<GeocodingResult | null> {
    if (!this.apiKey || !address.trim()) return null

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address.trim())
    url.searchParams.set('key', this.apiKey)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS)

      const res = await fetch(url.toString(), { signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) {
        console.warn('[geocoding] HTTP error', res.status)
        return null
      }

      const json = await res.json() as {
        status: string
        results: Array<{
          formatted_address: string
          geometry: { location: { lat: number; lng: number } }
        }>
      }

      if (json.status !== 'OK' || !json.results.length) {
        if (json.status !== 'ZERO_RESULTS') {
          console.warn('[geocoding] API status:', json.status)
        }
        return null
      }

      const first = json.results[0]
      return {
        latitude: first.geometry.location.lat,
        longitude: first.geometry.location.lng,
        normalizedAddress: first.formatted_address,
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('[geocoding] Request timed out for address:', address)
      } else {
        console.warn('[geocoding] Unexpected error:', err)
      }
      return null
    }
  }
}
