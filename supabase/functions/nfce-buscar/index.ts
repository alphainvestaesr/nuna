// NuNa · Edge Function nfce-buscar
// Recebe { url } (link do QR Code de uma NFC-e), abre a pagina publica da SEFAZ
// no servidor (o navegador nao consegue por causa de CORS) e devolve
// { ok, nota: { emitente, cnpj, data_emissao, total, itens[] } }.
// Exige usuario logado (verify_jwt) e so aceita enderecos de SEFAZ/Fazenda (.gov.br).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function hostPermitido(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
  return h.endsWith(".gov.br") && /(sefaz|fazenda|sefin|nfce|nfe|svrs|sat)/.test(h);
}

const num = (s: string | undefined | null): number => {
  if (!s) return 0;
  const v = parseFloat(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return isFinite(v) ? v : 0;
};
const limpa = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

function parseNFCeHtml(html: string) {
  const h = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const emit = h.match(/<div[^>]*class="[^"]*txtTopo[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    h.match(/<div[^>]*id="u20"[^>]*>([\s\S]*?)<\/div>/i);
  const emitente = emit ? limpa(emit[1]) : null;
  const txt = limpa(h);
  const cnpj = (txt.match(/CNPJ:?\s*([\d./-]{14,18})/i) || [])[1] || null;
  const dm = txt.match(/Emiss[aã]o:?\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
  const data_emissao = dm ? `${dm[3]}-${dm[2]}-${dm[1]}T${dm[4]}-03:00` : null;

  const itens: { desc: string; qtd: number; un: string; unit: number; total: number }[] = [];
  const linhas = h.split(/<tr[\s>]/i).filter((t) => /class="[^"]*txtTit[^"]*"/i.test(t));
  for (const t of linhas) {
    const d = t.match(/class="[^"]*txtTit[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const q = t.match(/class="[^"]*Rqtd[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const un = t.match(/class="[^"]*RUN[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const vu = t.match(/class="[^"]*RvlUnit[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const vt = t.match(/class="[^"]*\bvalor\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (!d) continue;
    itens.push({
      desc: limpa(d[1]),
      qtd: q ? num(limpa(q[1]).replace(/^.*?:/, "")) : 1,
      un: un ? limpa(un[1]).replace(/^.*?:/, "").trim() : "",
      unit: vu ? num(limpa(vu[1]).replace(/^.*?:/, "")) : 0,
      total: vt ? num(limpa(vt[1])) : 0,
    });
  }
  const tm = h.match(/totalNumb[^"]*txtMax[^>]*>\s*([\d.,]+)/i) || txt.match(/Valor a pagar R\$:?\s*([\d.,]+)/i);
  let total = tm ? num(tm[1]) : 0;
  if (!total && itens.length) total = Math.round(itens.reduce((s, i) => s + i.total, 0) * 100) / 100;
  return { emitente, cnpj, data_emissao, total, itens };
}

const tag = (x: string, t: string): string | null => {
  const m = x.match(new RegExp("<" + t + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + t + ">", "i"));
  return m ? m[1].trim() : null;
};
const xmlTxt = (s: string) => limpa(s.replace(/<!\[CDATA\[|\]\]>/g, ""));

// A SEFAZ-PE devolve a nota em XML (o navegador aplica um XSL para mostrar a tela).
const nx = (s: string | null): number => { const v = parseFloat(String(s || "").trim()); return isFinite(v) ? v : 0; };

export function parseNFCeXml(xml: string) {
  const emit = tag(xml, "emit") || "";
  const emitente = xmlTxt(tag(emit, "xNome") || tag(emit, "xFant") || "") || null;
  const cnpj = tag(emit, "CNPJ");
  const dh = tag(xml, "dhEmi");
  const itens: { desc: string; qtd: number; un: string; unit: number; total: number; ean?: string; cod?: string }[] = [];
  const dets = xml.match(/<det\s[\s\S]*?<\/det>/gi) || [];
  for (const d of dets) {
    const prod = tag(d, "prod") || d;
    const ean = (tag(prod, "cEAN") || "").replace(/\D/g, "");
    const qtd = nx(tag(prod, "qCom"));
    const bruto = nx(tag(prod, "vProd"));
    const desc = nx(tag(prod, "vDesc"));
    itens.push({
      desc: xmlTxt(tag(prod, "xProd") || ""),
      qtd: qtd || 1,
      un: xmlTxt(tag(prod, "uCom") || ""),
      unit: nx(tag(prod, "vUnCom")),
      total: Math.round((bruto - desc) * 100) / 100,
      ...(ean.length >= 8 && !/^0+$/.test(ean) ? { ean } : {}),
      cod: xmlTxt(tag(prod, "cProd") || "") || undefined,
    });
  }
  const icms = tag(xml, "ICMSTot") || "";
  let total = nx(tag(icms, "vNF"));
  if (!total && itens.length) total = Math.round(itens.reduce((s, i) => s + i.total, 0) * 100) / 100;
  return { emitente, cnpj, data_emissao: dh, total, itens };
}

export function parseNFCe(body: string) {
  if (/<nfeProc|<NFe[\s>]/i.test(body)) return parseNFCeXml(body);
  return parseNFCeHtml(body);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { url } = await req.json();
    const u = new URL(String(url || ""));
    if (!hostPermitido(u)) return json({ ok: false, erro: "Endereço não é de uma SEFAZ conhecida." }, 400);
    const r = await fetch(u.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (NuNa)", "Accept": "text/html,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return json({ ok: false, erro: `A SEFAZ respondeu ${r.status}.` });
    const finalHost = new URL(r.url);
    if (!hostPermitido(finalHost)) return json({ ok: false, erro: "Redirecionamento para endereço não permitido." }, 400);
    const buf = new Uint8Array(await r.arrayBuffer());
    let html = new TextDecoder("utf-8").decode(buf);
    if (/charset=["']?iso-8859-1/i.test(html) || html.includes("�")) html = new TextDecoder("iso-8859-1").decode(buf);
    const nota = parseNFCe(html);
    if (!nota.itens.length) {
      return json({ ok: false, erro: /captcha|recaptcha/i.test(html) ? "A SEFAZ pediu verificação (captcha)." : "Não reconheci os itens nessa página da SEFAZ." });
    }
    return json({ ok: true, nota });
  } catch (e) {
    return json({ ok: false, erro: String((e as Error).message || e) }, 500);
  }
});
