// Grafy dashboardů Ostravy: CSV z data.jakubvozar.cz -> Plotly (načítá se z CDN až když je na stránce graf).
// Každý graf je <div data-ostrava-chart="název"> (komponenta OstravaChart.astro); název = klíč v CHARTS níže.

const DATA = "https://data.jakubvozar.cz/ostrava";
const PLOTLY = "https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@2.35.2/plotly-basic.min.js";

type Row = Record<string, string>;
type Spec = { data: any[]; layout?: any };

const C = {
  skutecnost: "#2563eb",
  rozpocet: "#9ca3af",
  pro: "#16a34a",
  proti: "#dc2626",
  zdrzel: "#d97706",
  nehlasoval: "#9ca3af",
  nepritomen: "#cbd5e1",
  ostatni: "#64748b",
};

// --- CSV (středník, uvozovky podle Python csv.writer) ---
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0]);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const cache = new Map<string, Promise<Row[]>>();
function csv(name: string): Promise<Row[]> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${DATA}/${name}.csv`).then((r) => {
      if (!r.ok) throw new Error(`${name}.csv: HTTP ${r.status}`);
      return r.text();
    }).then(parseCsv));
  }
  return cache.get(name)!;
}

const num = (s: string) => (s === "" ? 0 : Number(s));
const mil = (kc: number) => Math.round(kc / 1e5) / 10;
const sum = (rows: Row[], col: string) => rows.reduce((a, r) => a + num(r[col]), 0);
const short = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const AKTUALNI_ROK = new Date().getFullYear();

// --- Definice grafů ---
const CHARTS: Record<string, () => Promise<Spec>> = {
  async "rozpocet-roky"() {
    const rows = await csv("web_rozpocet_roky");
    const roky = [...new Set(rows.map((r) => r.rok))].sort();
    const per = (rok: string, col: string) => mil(sum(rows.filter((r) => r.rok === rok), col));
    const x = roky.map((r) => (Number(r) === AKTUALNI_ROK ? `${r} (průběžně)` : r));
    return {
      data: [
        { type: "bar", name: "Rozpočet výdajů (po změnách)", x, y: roky.map((r) => per(r, "rozpocet_vydaje")), marker: { color: C.rozpocet } },
        { type: "bar", name: "Skutečné výdaje", x, y: roky.map((r) => per(r, "vydaje")), marker: { color: C.skutecnost } },
      ],
      layout: { barmode: "group", yaxis: { title: { text: "mil. Kč" } } },
    };
  },

  async "rozpocet-oblasti"() {
    const rows = await csv("web_rozpocet_oblasti");
    const rok = String(Math.max(...rows.map((r) => num(r.rok)).filter((r) => r < AKTUALNI_ROK)));
    const data = rows.filter((r) => r.rok === rok).map((r) => ({ o: r.oblast, v: mil(num(r.vydaje)) }))
      .sort((a, b) => a.v - b.v).slice(-12);
    return {
      data: [{ type: "bar", orientation: "h", x: data.map((d) => d.v), y: data.map((d) => d.o), marker: { color: C.skutecnost },
        hovertemplate: "%{y}: %{x:,.1f} mil. Kč<extra></extra>" }],
      layout: { title: { text: `Výdaje ${rok} podle oblastí (12 největších)`, font: { size: 14 } },
        xaxis: { title: { text: "mil. Kč" } }, margin: { l: 220 } },
    };
  },

  async "zu-obvody"() {
    const rows = (await csv("zu_obvody")).filter((r) => r.ukazatel === "Výdaje celkem po konsolidaci"
      && !["Obvody celkem", "Magistrát / celoměstské", "Statutární město celkem"].includes(r.jednotka));
    const rok = rows[0]?.rok ?? "";
    const d = rows.map((r) => ({ j: r.jednotka, sk: mil(num(r.skutecnost)), ur: mil(num(r.upraveny)) })).sort((a, b) => a.sk - b.sk);
    return {
      data: [
        { type: "bar", orientation: "h", name: "Upravený rozpočet", x: d.map((x) => x.ur), y: d.map((x) => x.j), marker: { color: C.rozpocet } },
        { type: "bar", orientation: "h", name: "Skutečnost", x: d.map((x) => x.sk), y: d.map((x) => x.j), marker: { color: C.skutecnost } },
      ],
      layout: { barmode: "group", title: { text: `Výdaje všech 23 obvodů ${rok} (závěrečný účet)`, font: { size: 14 } },
        xaxis: { title: { text: "mil. Kč" } }, margin: { l: 190 }, height: 720 },
    };
  },

  async "akce-top"() {
    const rows = (await csv("web_akce_top")).map((r) => ({ ...r, v: mil(num(r.skutecnost_celkem)) })).sort((a, b) => a.v - b.v);
    return {
      data: [{ type: "bar", orientation: "h", x: rows.map((r) => r.v), y: rows.map((r) => short(r.nazev_akce, 38)),
        customdata: rows.map((r) => [r.zadavatel, r.prvni_rok, r.posledni_rok, r.nazev_akce]), marker: { color: C.skutecnost },
        hovertemplate: "%{customdata[3]}<br>%{customdata[0]}, %{customdata[1]}–%{customdata[2]}<br>%{x:,.1f} mil. Kč<extra></extra>" }],
      layout: { xaxis: { title: { text: "skutečnost celkem, mil. Kč" } }, margin: { l: 260 }, height: 760 },
    };
  },

  async "vox"() {
    const rows = (await csv("web_vox")).sort((a, b) => num(a.rok) - num(b.rok));
    const x = rows.map((r) => (num(r.rok) === AKTUALNI_ROK ? `${r.rok} (průběžně)` : r.rok));
    return {
      data: [
        { type: "bar", name: "Rozpočet (po změnách)", x, y: rows.map((r) => mil(num(r.rozpocet))), marker: { color: C.rozpocet } },
        { type: "bar", name: "Skutečnost", x, y: rows.map((r) => mil(num(r.skutecnost))), marker: { color: C.skutecnost } },
      ],
      layout: { barmode: "group", title: { text: "VOX (ORG 8230) po letech", font: { size: 14 } }, yaxis: { title: { text: "mil. Kč" } } },
    };
  },

  async "dodavatele-top"() {
    const rows = (await csv("web_dodavatele_top")).map((r) => ({ ...r, v: mil(num(r.vydaje_celkem)) })).sort((a, b) => a.v - b.v);
    return {
      data: [{ type: "bar", orientation: "h", x: rows.map((r) => r.v), y: rows.map((r) => short(r.dodavatel, 40)),
        customdata: rows.map((r) => [r.ico, r.pocet_akci, r.pocet_plateb, r.dodavatel]), marker: { color: C.skutecnost },
        hovertemplate: "%{customdata[3]} (IČO %{customdata[0]})<br>%{customdata[1]} akcí, %{customdata[2]} plateb<br>%{x:,.1f} mil. Kč<extra></extra>" }],
      layout: { xaxis: { title: { text: "platby na akce celkem, mil. Kč" } }, margin: { l: 280 }, height: 760 },
    };
  },

  async "hlasovani-listiny"() {
    return hlasovani("Všechna hlasování");
  },
  async "hlasovani-listiny-akce"() {
    return hlasovani("Hlasování k akcím");
  },
};

async function hlasovani(rozsah: string): Promise<Spec> {
  const rows = (await csv("web_hlasovani_listiny")).filter((r) => r.rozsah === rozsah);
  const listiny = [...new Set(rows.map((r) => r.kandidatni_listina))];
  const total = (l: string) => sum(rows.filter((r) => r.kandidatni_listina === l), "pocet");
  const known = ["Pro", "Proti", "Zdržel se", "Nehlasoval", "Nepřítomen"];
  const colors: Record<string, string> = { Pro: C.pro, Proti: C.proti, "Zdržel se": C.zdrzel, Nehlasoval: C.nehlasoval, "Nepřítomen": C.nepritomen };
  const hlasy = [...known.filter((h) => rows.some((r) => r.hlas === h)),
    ...[...new Set(rows.map((r) => r.hlas))].filter((h) => !known.includes(h))];
  listiny.sort((a, b) => {
    const pro = (l: string) => sum(rows.filter((r) => r.kandidatni_listina === l && r.hlas === "Pro"), "pocet") / total(l);
    return pro(a) - pro(b);
  });
  return {
    data: hlasy.map((h) => ({
      type: "bar", orientation: "h", name: h, y: listiny.map((l) => short(l, 40)),
      x: listiny.map((l) => Math.round(1000 * sum(rows.filter((r) => r.kandidatni_listina === l && r.hlas === h), "pocet") / total(l)) / 10),
      marker: { color: colors[h] ?? C.ostatni },
      hovertemplate: `%{y}<br>${h}: %{x:.1f} %<extra></extra>`,
    })),
    layout: { barmode: "stack", xaxis: { title: { text: "% hlasů zastupitelů listiny" }, range: [0, 100] }, margin: { l: 260 },
      height: 120 + 44 * listiny.length },
  };
}

// --- Vykreslení ---
let plotly: Promise<any> | null = null;
function loadPlotly(): Promise<any> {
  if (!plotly) {
    plotly = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PLOTLY;
      s.onload = () => resolve((window as any).Plotly);
      s.onerror = () => reject(new Error("Plotly se nenačetl"));
      document.head.appendChild(s);
    });
  }
  return plotly;
}

function themeLayout(extra: any = {}) {
  const dark = document.documentElement.classList.contains("dark");
  const fg = dark ? "#e5e7eb" : "#374151";
  const grid = dark ? "#374151" : "#e5e7eb";
  const narrow = window.innerWidth < 640;
  const margin = { t: extra.title ? 48 : 16, r: 16, b: 48, ...(extra.margin ?? {}) };
  if (narrow && margin.l) margin.l = Math.min(margin.l, 140);
  return {
    ...extra,
    margin,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "inherit", color: fg, size: narrow ? 11 : 13 },
    xaxis: { gridcolor: grid, zerolinecolor: grid, automargin: true, ...(extra.xaxis ?? {}) },
    yaxis: { gridcolor: grid, zerolinecolor: grid, automargin: true, ...(extra.yaxis ?? {}) },
    legend: { orientation: "h", y: -0.18, ...(extra.legend ?? {}) },
    separators: ", ",
  };
}

const drawn: { el: HTMLElement; spec: Spec }[] = [];

async function draw(el: HTMLElement) {
  const name = el.dataset.ostravaChart!;
  const make = CHARTS[name];
  if (!make) return;
  try {
    const [P, spec] = await Promise.all([loadPlotly(), make()]);
    el.innerHTML = "";
    el.classList.remove("chart-loading", "flex", "items-center", "justify-center");
    el.style.minHeight = "";
    await P.newPlot(el, spec.data, themeLayout(spec.layout), { responsive: true, displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"] });
    drawn.push({ el, spec });
  } catch (e) {
    el.classList.remove("chart-loading");
    el.innerHTML = `<p class="p-6 text-center">Graf se nepodařilo načíst (${(e as Error).message}). Data jsou na <a class="underline" href="/data">stránce Data</a>.</p>`;
  }
}

function init() {
  const els = [...document.querySelectorAll<HTMLElement>("[data-ostrava-chart]")];
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); draw(e.target as HTMLElement); }
  }, { rootMargin: "300px" });
  els.forEach((el) => io.observe(el));
  // přepnutí světlý/tmavý režim -> přebarvit
  new MutationObserver(() => {
    const P = (window as any).Plotly;
    if (P) drawn.forEach(({ el, spec }) => P.relayout(el, themeLayout(spec.layout)));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

init();
