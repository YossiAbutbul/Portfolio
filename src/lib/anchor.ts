/**
 * Where the page scrolls to for a section link. Usually the section's top; a pinned beat whose words
 * only come in partway through its run says where to land instead with data-anchor (a fraction of
 * the run: 0 its start, 1 its end), so a link never lands on an empty shot.
 */
export function anchorTop(el: HTMLElement, offset = 0) {
  const top = el.getBoundingClientRect().top + window.scrollY;
  const at = Number.parseFloat(el.dataset.anchor ?? "");
  // Reduced motion unpins the beats (their run is then shorter than the screen): just the top.
  const run = Math.max(0, el.offsetHeight - window.innerHeight);
  return Math.max(0, top + (Number.isFinite(at) ? at * run : 0) + offset);
}
