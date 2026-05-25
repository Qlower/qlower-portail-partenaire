"use client";

// Éditeur d'email par blocs — UX simple sans HTML visible.
// Cf. src/lib/block-editor.ts pour le modèle de données + parse/serialize.

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowDown,
  ArrowUp,
  Trash2,
  Plus,
  Code,
  Eye,
  Layout,
  Heading1,
  Heading2,
  Type,
  List,
  ListOrdered,
  MousePointerClick,
  Info,
  Minus,
  GripVertical,
} from "lucide-react";
import {
  type Block,
  type BlockType,
  type CalloutBlock,
  type ListBlock,
  type ButtonBlock,
  blocksToHtml,
  htmlToBlocks,
  createBlock,
  moveBlock,
  removeBlock,
  updateBlock,
} from "@/lib/block-editor";

// ─── API impérative exposée au parent ───────────────────────────────────────
export interface BlockEditorHandle {
  /** Insère un placeholder ({{xxx}}) au curseur dans le dernier champ focusé. */
  insertVariableAtCursor: (placeholder: string) => boolean;
}

interface Props {
  html: string;
  onChange: (html: string) => void;
}

// ─── Composant principal ────────────────────────────────────────────────────
const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor(
  { html, onChange },
  ref,
) {
  const [blocks, setBlocks] = useState<Block[]>(() => htmlToBlocks(html));
  const [seenHtml, setSeenHtml] = useState(html);
  const [htmlMode, setHtmlMode] = useState(false);
  const [showRendered, setShowRendered] = useState(false);

  // Pattern React officiel : si le HTML parent change pour une raison
  // externe (changement de template…), on re-parse en blocs sans useEffect.
  // setState pendant le render est OK pour les "derived state from props".
  if (html !== seenHtml) {
    setSeenHtml(html);
    setBlocks(htmlToBlocks(html));
  }

  const propagate = (next: Block[]) => {
    setBlocks(next);
    const newHtml = blocksToHtml(next);
    // On mémorise ce HTML pour éviter le re-parse au prochain render quand
    // le parent va nous le repasser via onChange.
    setSeenHtml(newHtml);
    onChange(newHtml);
  };

  // Map "blockId:field" → input element. Et clé du dernier input focusé.
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const focusedKey = useRef<string | null>(null);

  // Expose l'API impérative au parent
  useImperativeHandle(ref, () => ({
    insertVariableAtCursor: (placeholder: string) => {
      const key = focusedKey.current;
      if (!key) return false;
      const el = inputRefs.current.get(key);
      if (!el) return false;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + placeholder + el.value.slice(end);
      // Trigger un onChange React via setter natif
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, next);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + placeholder.length;
        el.setSelectionRange(pos, pos);
      });
      return true;
    },
  }));

  // ─── Mode HTML brut ─────────────────────────────────────────────────────
  if (htmlMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
            <Code className="size-3" /> Mode HTML brut (avancé)
          </Label>
          <button
            type="button"
            onClick={() => {
              setHtmlMode(false);
              setBlocks(htmlToBlocks(html));
            }}
            className="text-[11px] text-[#0A3855] hover:underline flex items-center gap-1"
          >
            <Layout className="size-3" /> Revenir au mode blocs
          </button>
        </div>
        <textarea
          value={html}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855]"
          placeholder="Contenu HTML…"
        />
        <p className="text-[10px] text-gray-400 italic">
          Mode HTML pour ajustements pointus. Coline préfère le mode blocs.
        </p>
      </div>
    );
  }

  // ─── Mode blocs (par défaut) ────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
          <Layout className="size-3" /> Contenu du mail (mode blocs)
        </Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRendered((v) => !v)}
            className="text-[11px] text-[#0A3855] hover:underline flex items-center gap-1"
            title="Aperçu rendu"
          >
            <Eye className="size-3" /> {showRendered ? "Masquer aperçu" : "Aperçu rendu"}
          </button>
          <span className="text-gray-200">|</span>
          <button
            type="button"
            onClick={() => setHtmlMode(true)}
            className="text-[11px] text-gray-500 hover:text-[#0A3855] hover:underline flex items-center gap-1"
            title="Édition HTML brute (avancé)"
          >
            <Code className="size-3" /> Voir le HTML
          </button>
        </div>
      </div>

      {showRendered && (
        <div className="border border-dashed border-[#0A3855]/30 rounded-lg p-4 bg-[#FAFCFD]">
          <p className="text-[10px] uppercase tracking-wider text-[#0A3855]/60 font-semibold mb-2">
            Aperçu (variables non substituées)
          </p>
          <div
            className="bg-white rounded border border-gray-200 p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }}
          />
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-400 italic mb-3">Aucun bloc dans le mail.</p>
          <p className="text-[11px] text-gray-400">Clique sur un bouton ci-dessous pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <BlockCard
              key={block.id}
              block={block}
              index={idx}
              total={blocks.length}
              onChange={(patch) => propagate(updateBlock(blocks, block.id, patch))}
              onMoveUp={() => propagate(moveBlock(blocks, block.id, -1))}
              onMoveDown={() => propagate(moveBlock(blocks, block.id, 1))}
              onRemove={() => propagate(removeBlock(blocks, block.id))}
              onFocus={(field) => {
                focusedKey.current = `${block.id}:${field}`;
              }}
              registerInput={(field, el) => {
                const key = `${block.id}:${field}`;
                if (el) inputRefs.current.set(key, el);
                else inputRefs.current.delete(key);
              }}
            />
          ))}
        </div>
      )}

      <div className="bg-[#E5EDF1]/30 border border-[#0A3855]/10 rounded-lg p-3">
        <p className="text-[11px] uppercase tracking-wider text-[#0A3855]/70 font-semibold mb-2 flex items-center gap-1.5">
          <Plus className="size-3" /> Ajouter un bloc
        </p>
        <div className="flex flex-wrap gap-1.5">
          <AddBlockButton type="title" icon={<Heading1 className="size-3" />} label="Titre" onAdd={(b) => propagate([...blocks, b])} />
          <AddBlockButton type="subtitle" icon={<Heading2 className="size-3" />} label="Sous-titre" onAdd={(b) => propagate([...blocks, b])} />
          <AddBlockButton type="paragraph" icon={<Type className="size-3" />} label="Paragraphe" onAdd={(b) => propagate([...blocks, b])} />
          <AddBlockButton type="list" icon={<List className="size-3" />} label="Liste" onAdd={(b) => propagate([...blocks, b])} />
          <AddBlockButton type="button" icon={<MousePointerClick className="size-3" />} label="Bouton" onAdd={(b) => propagate([...blocks, b])} />
          <AddBlockButton type="callout" icon={<Info className="size-3" />} label="Encart" onAdd={(b) => propagate([...blocks, b])} />
          <AddBlockButton type="divider" icon={<Minus className="size-3" />} label="Séparateur" onAdd={(b) => propagate([...blocks, b])} />
        </div>
      </div>
    </div>
  );
});

export default BlockEditor;

// ─── Bouton "Ajouter un bloc" ───────────────────────────────────────────────
function AddBlockButton({
  type,
  icon,
  label,
  onAdd,
}: {
  type: BlockType;
  icon: React.ReactNode;
  label: string;
  onAdd: (b: Block) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(createBlock(type))}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-[#0A3855]/20 text-[#0A3855] hover:bg-[#0A3855] hover:text-white hover:border-[#0A3855] transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Carte d'un bloc ────────────────────────────────────────────────────────
interface BlockCardProps {
  block: Block;
  index: number;
  total: number;
  onChange: (patch: Partial<Block>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onFocus: (field: string) => void;
  registerInput: (field: string, el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

function BlockCard(props: BlockCardProps) {
  const { block, index, total, onChange, onMoveUp, onMoveDown, onRemove, onFocus, registerInput } = props;

  const labels: Record<BlockType, { label: string; icon: React.ReactNode; bg: string; border: string }> = {
    title: { label: "Titre", icon: <Heading1 className="size-3.5" />, bg: "bg-[#E5EDF1]/40", border: "border-[#0A3855]/20" },
    subtitle: { label: "Sous-titre", icon: <Heading2 className="size-3.5" />, bg: "bg-[#E5EDF1]/30", border: "border-[#0A3855]/15" },
    paragraph: { label: "Paragraphe", icon: <Type className="size-3.5" />, bg: "bg-white", border: "border-gray-200" },
    list: { label: "Liste", icon: <List className="size-3.5" />, bg: "bg-white", border: "border-gray-200" },
    button: { label: "Bouton CTA", icon: <MousePointerClick className="size-3.5" />, bg: "bg-[#FFF5ED]", border: "border-[#F6CCA4]/40" },
    callout: { label: "Encart", icon: <Info className="size-3.5" />, bg: "bg-[#F0F7FA]", border: "border-[#0A3855]/15" },
    divider: { label: "Séparateur", icon: <Minus className="size-3.5" />, bg: "bg-gray-50", border: "border-gray-200" },
    html_raw: { label: "HTML brut", icon: <Code className="size-3.5" />, bg: "bg-amber-50", border: "border-amber-200" },
  };
  const meta = labels[block.type];

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-current/10 bg-white/50">
        <span className="text-[11px] font-semibold text-[#0A3855]/70 flex items-center gap-1.5">
          <GripVertical className="size-3 text-gray-300" />
          {meta.icon}
          {meta.label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0A3855] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Déplacer vers le haut"
          >
            <ArrowUp className="size-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0A3855] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Déplacer vers le bas"
          >
            <ArrowDown className="size-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600"
            title="Supprimer ce bloc"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <BlockBody
          block={block}
          onChange={onChange}
          onFocus={onFocus}
          registerInput={registerInput}
        />
      </div>
    </div>
  );
}

// ─── Édition du contenu selon le type ───────────────────────────────────────
function BlockBody({
  block,
  onChange,
  onFocus,
  registerInput,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onFocus: (field: string) => void;
  registerInput: (field: string, el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  if (block.type === "divider") {
    return (
      <div className="py-2 flex items-center justify-center">
        <hr className="w-full border-t border-gray-300" />
      </div>
    );
  }

  if (block.type === "title" || block.type === "subtitle") {
    return (
      <Input
        ref={(el) => registerInput("text", el)}
        value={block.text}
        onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
        onFocus={() => onFocus("text")}
        placeholder={block.type === "title" ? "Titre du mail" : "Sous-titre"}
        className="text-sm font-semibold text-[#0A3855] bg-white"
      />
    );
  }

  if (block.type === "paragraph") {
    return (
      <textarea
        ref={(el) => registerInput("text", el)}
        value={block.text}
        onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
        onFocus={() => onFocus("text")}
        rows={3}
        placeholder="Écris ton paragraphe ici… (Entrée = saut de ligne)"
        className="w-full rounded border border-gray-200 px-2.5 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855] resize-y"
      />
    );
  }

  if (block.type === "callout") {
    const callout = block as CalloutBlock;
    return (
      <div className="space-y-2">
        <textarea
          ref={(el) => registerInput("text", el)}
          value={callout.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          onFocus={() => onFocus("text")}
          rows={2}
          placeholder="Texte de l'encart (info, conseil, avertissement)…"
          className="w-full rounded border border-gray-200 px-2.5 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/20 focus:border-[#0A3855] bg-white"
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Style :</span>
          {(["info", "success", "warning", "neutral"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ tone: t } as Partial<Block>)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                callout.tone === t
                  ? "bg-[#0A3855] text-white border-[#0A3855]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {t === "info" ? "Info" : t === "success" ? "Succès" : t === "warning" ? "Attention" : "Neutre"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "list") {
    const list = block as ListBlock;
    return (
      <div className="space-y-1.5">
        {list.items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-gray-300 text-sm w-4">{list.ordered ? `${idx + 1}.` : "•"}</span>
            <Input
              ref={(el) => registerInput(`item-${idx}`, el)}
              value={item}
              onChange={(e) => {
                const next = [...list.items];
                next[idx] = e.target.value;
                onChange({ items: next } as Partial<Block>);
              }}
              onFocus={() => onFocus(`item-${idx}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = [...list.items];
                  next.splice(idx + 1, 0, "");
                  onChange({ items: next } as Partial<Block>);
                }
                if (e.key === "Backspace" && item === "" && list.items.length > 1) {
                  e.preventDefault();
                  const next = list.items.filter((_, i) => i !== idx);
                  onChange({ items: next } as Partial<Block>);
                }
              }}
              placeholder="Point de la liste"
              className="text-sm bg-white"
            />
            <button
              type="button"
              onClick={() => {
                const next = list.items.filter((_, i) => i !== idx);
                onChange({ items: next.length > 0 ? next : [""] } as Partial<Block>);
              }}
              className="text-gray-300 hover:text-rose-500"
              title="Supprimer ce point"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChange({ items: [...list.items, ""] } as Partial<Block>)}
            className="text-[11px] text-[#0A3855] hover:underline flex items-center gap-1"
          >
            <Plus className="size-3" /> Ajouter un point
          </button>
          <span className="text-gray-200">|</span>
          <button
            type="button"
            onClick={() => onChange({ ordered: !list.ordered } as Partial<Block>)}
            className="text-[11px] text-gray-500 hover:text-[#0A3855] flex items-center gap-1"
            title={list.ordered ? "Passer en liste à puces" : "Passer en liste numérotée"}
          >
            {list.ordered ? <List className="size-3" /> : <ListOrdered className="size-3" />}
            {list.ordered ? "Puces" : "Numérotée"}
          </button>
        </div>
      </div>
    );
  }

  if (block.type === "button") {
    const btn = block as ButtonBlock;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_3fr] gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-gray-500">Texte du bouton</Label>
          <Input
            ref={(el) => registerInput("text", el)}
            value={btn.text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
            onFocus={() => onFocus("text")}
            placeholder="Accéder à mon espace"
            className="text-sm bg-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-gray-500">Lien</Label>
          <Input
            ref={(el) => registerInput("url", el)}
            value={btn.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Block>)}
            onFocus={() => onFocus("url")}
            placeholder="{{setup_link}} ou https://..."
            className="text-sm font-mono bg-white"
          />
        </div>
      </div>
    );
  }

  if (block.type === "html_raw") {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] text-amber-700 italic">
          Bloc HTML non reconnu — édite en mode HTML brut pour le modifier.
        </p>
        <div
          className="bg-white rounded border border-amber-200 p-2 text-xs text-gray-600 max-h-32 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      </div>
    );
  }

  return null;
}
