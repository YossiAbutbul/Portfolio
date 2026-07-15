/**
 * Normalize a root-relative public asset path. The site is served from the
 * domain root, so this only guarantees a leading slash and passes absolute
 * URLs through untouched.
 */
export function withBasePath(path: string): string {
  if (!path) return "/";
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}
