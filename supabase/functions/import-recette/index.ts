// Lit une page web et en extrait la recette (données structurées schema.org/Recipe).
// Réservée aux utilisateurs connectés. Aucune donnée n'est conservée.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_BYTES = 2_000_000;

function isPrivateIp(h) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = h.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}
function isBlockedHost(host) {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (!h.includes(".") && !h.includes(":")) return true;
  return isPrivateIp(h);
}
async function hostIsSafe(host) {
  if (isBlockedHost(host)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return true;
  try {
    const ips = await Deno.resolveDns(host, "A");
    if (ips.some(isPrivateIp)) return false;
  } catch (_e) { /* résolution indisponible : les contrôles de nom restent appliqués */ }
  return true;
}

async function fetchPage(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    if (!["http:", "https:"].includes(url.protocol) || !(await hostIsSafe(url.hostname))) throw new Error("bad_url");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    let res;
    try {
      res = await fetch(url, {
        signal: ctl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LePanier/1.0; import de recette)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "fr,en;q=0.8",
        },
      });
    } catch (_e) {
      throw new Error("fetch_failed");
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url);
      continue;
    }
    if (!res.ok) throw new Error("fetch_failed");
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(Math.min(total, MAX_BYTES));
    let off = 0;
    for (const c of chunks) { buf.set(c.subarray(0, Math.max(0, buf.length - off)), off); off += c.length; }
    return new TextDecoder("utf-8").decode(buf);
  }
  throw new Error("fetch_failed");
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", agrave: "à", ecirc: "ê", ccedil: "ç", rsquo: "'", lsquo: "'", ocirc: "ô", icirc: "î", ucirc: "û", euro: "€", deg: "°", hellip: "…", ndash: "–", mdash: "—" };
function clean(s) {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function findRecipe(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r; }
    return null;
  }
  if (typeof node !== "object") return null;
  const t = node["@type"];
  if ((Array.isArray(t) ? t : [t]).some((x) => String(x).toLowerCase() === "recipe")) return node;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const r = findRecipe(node[k], depth + 1);
    if (r) return r;
  }
  return null;
}

function minutes(d) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(d ?? ""));
  if (!m) return 0;
  return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
}
function steps(ins) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === "string") { x.split(/\r?\n+/).forEach((l) => { const c = clean(l); if (c) out.push(c); }); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === "object") {
      if (x.itemListElement) walk(x.itemListElement);
      else if (x.text) walk(x.text);
      else if (x.name) walk(x.name);
    }
  };
  walk(ins);
  return out;
}

function extractRecipe(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch (_e) { continue; }
    const r = findRecipe(data);
    if (!r) continue;
    const yieldRaw = Array.isArray(r.recipeYield) ? r.recipeYield.join(" ") : r.recipeYield;
    const portions = parseInt((/\d+/.exec(String(yieldRaw ?? "")) || [])[0], 10) || 0;
    const total = minutes(r.totalTime) || minutes(r.cookTime) + minutes(r.prepTime);
    const ing = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : [])
      .map(clean).filter(Boolean);
    if (!ing.length) continue;
    return { titre: clean(r.name), portions, temps_min: total, ingredients: ing, etapes: steps(r.recipeInstructions) };
  }
  return null;
}

// payload d'un JWT déjà vérifié par la plateforme (verify_jwt)
function claims(req) {
  try {
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const p = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch (_e) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const c = claims(req);
  if (!c || c.role !== "authenticated" || !c.sub) return json({ error: "unauthorized" }, 401);
  try {
    const body = await req.json();
    let url;
    try { url = new URL(String(body.url || "")); } catch (_e) { return json({ error: "bad_url" }, 400); }
    const html = await fetchPage(url);
    const rec = extractRecipe(html);
    if (!rec) return json({ error: "no_recipe" }, 422);
    return json({ ...rec, source: url.href });
  } catch (e) {
    const code = e && e.message;
    if (code === "bad_url") return json({ error: "bad_url" }, 400);
    return json({ error: "fetch_failed" }, 502);
  }
});
