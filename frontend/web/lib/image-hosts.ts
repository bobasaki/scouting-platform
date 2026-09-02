/**
 * Remote hosts allowed through the next/image optimization endpoint.
 *
 * Automated catalog data only ever stores YouTube Data API thumbnails, which
 * live on these CDNs. Keeping the list closed stops /_next/image from acting
 * as an open fetch proxy for arbitrary URLs.
 */
export const OPTIMIZED_IMAGE_HOSTS = [
  "i.ytimg.com",
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
] as const;

/**
 * Whether a stored image URL may go through the optimizer. Off-list URLs
 * (e.g. an admin-pasted thumbnail) must render with `unoptimized` instead:
 * next/image throws at render time for hosts missing from remotePatterns.
 */
export function isOptimizedImageHost(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);

    return protocol === "https:" && (OPTIMIZED_IMAGE_HOSTS as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
}
