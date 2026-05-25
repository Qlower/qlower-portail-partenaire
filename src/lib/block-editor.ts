// Block editor : modèle de données pour l'édition d'emails partenaires
// sans avoir à manipuler de HTML.
//
// Les emails sont représentés comme une LISTE DE BLOCS (titre, paragraphe,
// liste, bouton, encart...). Chaque bloc se sérialise en HTML stylé Qlower
// au moment de la sauvegarde. Au chargement, on parse le HTML existant en
// blocs (best-effort) — si un fragment HTML est trop exotique pour notre
// parser, il atterrit dans un bloc `html_raw` qui reste éditable en mode
// "HTML brut" mais pas dans l'éditeur visuel.
//
// Pas de dépendance externe. Parser HTML via DOMParser côté client.

export type BlockType =
  | "title"
  | "subtitle"
  | "paragraph"
  | "list"
  | "button"
  | "callout"
  | "divider"
  | "html_raw";

export interface BlockBase {
  id: string;
}

export interface TitleBlock extends BlockBase {
  type: "title";
  text: string;
}

export interface SubtitleBlock extends BlockBase {
  type: "subtitle";
  text: string;
}

export interface ParagraphBlock extends BlockBase {
  type: "paragraph";
  text: string;
}

export interface ListBlock extends BlockBase {
  type: "list";
  ordered: boolean; // false = puces, true = numéroté
  items: string[];
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  text: string;
  url: string;
}

export interface CalloutBlock extends BlockBase {
  type: "callout";
  text: string;
  tone: "info" | "success" | "warning" | "neutral";
}

export interface DividerBlock extends BlockBase {
  type: "divider";
}

export interface HtmlRawBlock extends BlockBase {
  type: "html_raw";
  html: string;
}

export type Block =
  | TitleBlock
  | SubtitleBlock
  | ParagraphBlock
  | ListBlock
  | ButtonBlock
  | CalloutBlock
  | DividerBlock
  | HtmlRawBlock;

// ─── Génération d'IDs uniques (côté client) ─────────────────────────────────
export function makeBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (très rare) : non-crypto
  return `b-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// ─── Création de blocs par défaut ────────────────────────────────────────────
export function createBlock(type: BlockType): Block {
  const id = makeBlockId();
  switch (type) {
    case "title":
      return { id, type: "title", text: "Titre" };
    case "subtitle":
      return { id, type: "subtitle", text: "Sous-titre" };
    case "paragraph":
      return { id, type: "paragraph", text: "" };
    case "list":
      return { id, type: "list", ordered: false, items: [""] };
    case "button":
      return { id, type: "button", text: "Accéder à mon espace", url: "{{setup_link}}" };
    case "callout":
      return { id, type: "callout", text: "Information importante", tone: "info" };
    case "divider":
      return { id, type: "divider" };
    case "html_raw":
      return { id, type: "html_raw", html: "" };
  }
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  title: "Titre",
  subtitle: "Sous-titre",
  paragraph: "Paragraphe",
  list: "Liste",
  button: "Bouton CTA",
  callout: "Encart",
  divider: "Séparateur",
  html_raw: "HTML brut",
};

// ─── Sérialisation Blocks → HTML ─────────────────────────────────────────────
// Génère du HTML stylé Qlower (couleurs navy #0A3855, sable #F6CCA4).
// Les variables {{xxx}} restent inchangées dans le texte — elles seront
// substituées plus tard par send-campaign avant l'envoi.

function escapeForAttribute(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}

// On n'échappe PAS les {{var}} (elles doivent rester littérales) et on garde
// le texte tel quel — Resend reçoit du HTML, et les utilisateurs tapent
// rarement des < ou & littéraux dans un mail (et si oui ils savent ce qu'ils
// font). On échappe juste les caractères qui casseraient le HTML.
function textToInlineHtml(s: string): string {
  // Garde les variables {{xxx}} intactes
  // Remplace les sauts de ligne par <br/> pour préserver le wrapping
  return s.replace(/\n/g, "<br/>");
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join("\n\n");
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case "title":
      return `<h2 style="color:#0A3855;margin:24px 0 12px;font-size:20px;font-weight:700;">${textToInlineHtml(block.text)}</h2>`;
    case "subtitle":
      return `<h3 style="color:#0A3855;margin:20px 0 8px;font-size:16px;font-weight:600;">${textToInlineHtml(block.text)}</h3>`;
    case "paragraph":
      return `<p style="margin:0 0 12px;color:#374151;line-height:1.6;">${textToInlineHtml(block.text)}</p>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const lis = block.items
        .filter((i) => i.trim().length > 0)
        .map((i) => `  <li style="margin-bottom:6px;">${textToInlineHtml(i)}</li>`)
        .join("\n");
      return `<${tag} style="margin:0 0 16px;padding-left:20px;color:#374151;line-height:1.6;">\n${lis}\n</${tag}>`;
    }
    case "button":
      return `<p style="text-align:center;margin:24px 0;">
  <a href="${escapeForAttribute(block.url)}" style="display:inline-block;background:#0A3855;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${textToInlineHtml(block.text)}</a>
</p>`;
    case "callout": {
      const colors: Record<CalloutBlock["tone"], { bg: string; border: string; color: string }> = {
        info: { bg: "#F0F7FA", border: "#0A3855", color: "#0A3855" },
        success: { bg: "#F0FDF4", border: "#16A34A", color: "#15803D" },
        warning: { bg: "#FFF7ED", border: "#F97316", color: "#9A3412" },
        neutral: { bg: "#F8FAFC", border: "#94A3B8", color: "#475569" },
      };
      const c = colors[block.tone];
      return `<div style="background:${c.bg};border-left:4px solid ${c.border};border-radius:8px;padding:14px 16px;margin:16px 0;color:${c.color};font-size:14px;line-height:1.6;">${textToInlineHtml(block.text)}</div>`;
    }
    case "divider":
      return `<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />`;
    case "html_raw":
      return block.html;
  }
}

// ─── Parsing HTML → Blocks ───────────────────────────────────────────────────
// Best-effort : on tente de reconnaître les patterns standards (h2, h3, p,
// ul, ol, hr, et nos boutons / encarts stylés). Tout le reste tombe dans un
// bloc `html_raw` qu'on garde tel quel pour ne rien perdre.

function detectButton(el: Element): { text: string; url: string } | null {
  // Pattern : <p>...<a href="..." style="...background...">Texte</a>...</p>
  const a = el.querySelector("a[href]");
  if (!a) return null;
  const style = (a.getAttribute("style") || "").toLowerCase();
  if (!style.includes("background") || !style.includes("border-radius")) return null;
  return {
    text: a.textContent || "Bouton",
    url: a.getAttribute("href") || "",
  };
}

function detectCallout(el: Element): { text: string; tone: CalloutBlock["tone"] } | null {
  if (el.tagName.toLowerCase() !== "div") return null;
  const style = (el.getAttribute("style") || "").toLowerCase();
  if (!style.includes("background") && !style.includes("border-left")) return null;
  // Devine le ton selon la couleur
  let tone: CalloutBlock["tone"] = "info";
  if (style.includes("#f0fdf4") || style.includes("#16a34a")) tone = "success";
  else if (style.includes("#fff7ed") || style.includes("#f97316")) tone = "warning";
  else if (style.includes("#f8fafc")) tone = "neutral";
  return { text: el.textContent?.trim() || "", tone };
}

export function htmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  // SSR-safe : on n'est appelé que côté client (BlockEditor est "use client")
  if (typeof DOMParser === "undefined") {
    return [{ id: makeBlockId(), type: "html_raw", html }];
  }
  const doc = new DOMParser().parseFromString(`<div id="__root__">${html}</div>`, "text/html");
  const root = doc.getElementById("__root__");
  if (!root) return [{ id: makeBlockId(), type: "html_raw", html }];

  const blocks: Block[] = [];

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent || "").trim();
      if (txt) blocks.push({ id: makeBlockId(), type: "paragraph", text: txt });
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Bouton (détecté avant <p> car emballé dans un <p>)
    const btn = detectButton(el);
    if (btn) {
      blocks.push({ id: makeBlockId(), type: "button", text: btn.text, url: btn.url });
      continue;
    }

    if (tag === "h1" || tag === "h2") {
      blocks.push({ id: makeBlockId(), type: "title", text: el.textContent?.trim() || "" });
      continue;
    }
    if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      blocks.push({ id: makeBlockId(), type: "subtitle", text: el.textContent?.trim() || "" });
      continue;
    }
    if (tag === "p") {
      const text = (el as HTMLElement).innerHTML
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (text) blocks.push({ id: makeBlockId(), type: "paragraph", text });
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.querySelectorAll(":scope > li"))
        .map((li) => li.textContent?.trim() || "")
        .filter((t) => t.length > 0);
      if (items.length > 0) {
        blocks.push({ id: makeBlockId(), type: "list", ordered: tag === "ol", items });
      }
      continue;
    }
    if (tag === "hr") {
      blocks.push({ id: makeBlockId(), type: "divider" });
      continue;
    }

    // Encart (div stylé) — détecté après les blocs précédents
    if (tag === "div") {
      const callout = detectCallout(el);
      if (callout) {
        blocks.push({ id: makeBlockId(), type: "callout", text: callout.text, tone: callout.tone });
        continue;
      }
    }

    // Fallback : on garde le HTML brut pour ne rien perdre
    blocks.push({ id: makeBlockId(), type: "html_raw", html: (el as HTMLElement).outerHTML });
  }

  // Si le parse n'a rien sorti d'utile (un seul html_raw qui couvre tout),
  // on a quand même un bloc — pas grave, l'utilisateur peut l'éditer en mode HTML.
  return blocks;
}

// ─── Helpers de manipulation pour le composant React ─────────────────────────
export function moveBlock(blocks: Block[], id: string, direction: -1 | 1): Block[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return blocks;
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= blocks.length) return blocks;
  const next = [...blocks];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  return next;
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

export function updateBlock<T extends Block>(blocks: Block[], id: string, patch: Partial<T>): Block[] {
  return blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b));
}

export function insertBlockAfter(blocks: Block[], afterId: string | null, newBlock: Block): Block[] {
  if (!afterId) return [...blocks, newBlock];
  const idx = blocks.findIndex((b) => b.id === afterId);
  if (idx === -1) return [...blocks, newBlock];
  const next = [...blocks];
  next.splice(idx + 1, 0, newBlock);
  return next;
}
