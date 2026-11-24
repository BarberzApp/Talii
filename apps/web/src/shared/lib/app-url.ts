/**
 * Public base URL of the website (no trailing slash): NEXT_PUBLIC_APP_URL when
 * set, otherwise the current origin in the browser. Used for booking links.
 */
export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  const base = configured || (typeof window !== 'undefined' ? window.location.origin : '')
  return base.replace(/\/+$/, '')
}

/** Full booking link for a barber's username, e.g. https://example.com/book/sharplines. */
export function bookingLink(username: string): string {
  return `${appBaseUrl()}/book/${encodeURIComponent(username)}`
}

/** Booking link without the protocol, for display ("example.com/book/sharplines"). */
export function bookingLinkLabel(username: string): string {
  return bookingLink(username).replace(/^https?:\/\//, '')
}
