function fill(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

function renderShared() {
  fill("also", `<h3>Also</h3>${ALSO.map(([n, s]) => `<div><span>${esc(n)}</span><span>${esc(s)}</span></div>`).join("")}`);
  fill("bg-list", BACKGROUND.map(([y, r, p, d]) => `
    <div class="bg-item"><span class="mono" style="color:var(--ink-faint)">${esc(y)}</span>
      <div><h3>${esc(r)}</h3><span class="place">${esc(p)}</span><p>${esc(d)}</p></div></div>`).join(""));
  fill("seminar", `<span class="mono" style="color:var(--ink-faint)">${esc(SEMINAR.meta)}</span><h3>${esc(SEMINAR.title)}</h3><p>${esc(SEMINAR.body)}</p>`);
  fill("contact-body", `
    <p class="lede">Work, a question, or something you think I would find interesting.</p>
    <span class="big" data-email>${EMAIL}</span>
    <div class="row">
      <button class="btn" type="button" id="copy-email">Copy email</button>
      <a class="btn ghost" href="https://github.com/YossiAbutbul" target="_blank" rel="noreferrer">GitHub</a>
      <a class="btn ghost" href="https://www.linkedin.com/in/yossi-abutbul-550958199/" target="_blank" rel="noreferrer">LinkedIn</a>
      <span class="mono" style="color:var(--ink-faint)">CV download lives here on the real site</span>
    </div>`);
  document.getElementById("copy-email")?.addEventListener("click", (e) => copyEmail(e.currentTarget));
}

/** Marks the nav link of the section currently under the header. One observer, no scroll handler. */
function navSpy(onChange) {
  const links = [...document.querySelectorAll(".nav ul a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + e.target.id)));
      onChange?.(e.target.id);
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => io.observe(s));
}
