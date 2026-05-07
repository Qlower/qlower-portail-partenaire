"use client";

import { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";
import { usePartnerContext } from "@/app/dashboard/layout";
import { buildSignupLink } from "@/services/links";

interface Props {
  /** Optional CTA label override */
  label?: string;
  /** Compact (icon-only) variant */
  compact?: boolean;
}

/**
 * Button that copies the partner's tracked signup link to the clipboard.
 *
 *   https://www.qlower.com/qlower-x-partenaire?utm_source=<UTM>&utm_medium=affiliation&utm_campaign=<CODE>
 *
 * Used on the public-facing client-share pages (/dashboard/expliquer,
 * /dashboard/emails) to discourage partners from copy-pasting the raw
 * Notion link to their clients (which loses attribution).
 */
export default function ShareSignupButton({ label, compact }: Props) {
  const { partner } = usePartnerContext();
  const [copied, setCopied] = useState(false);
  const link = buildSignupLink(partner.utm || "", partner.code || null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback: select+execCommand (older browsers / non-secure contexts)
      const t = document.createElement("textarea");
      t.value = link;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  if (compact) {
    return (
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#0A3855] text-white hover:bg-[#0d4f78] transition"
        title={`Copier ${link}`}
      >
        {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copié !" : (label || "Copier mon lien")}
      </button>
    );
  }

  return (
    <div className="bg-[#FFF5ED] border border-[#F6CCA4] rounded-lg p-4 space-y-3">
      <div>
        <div className="text-xs font-semibold text-[#0A3855] uppercase tracking-wider mb-1">
          🔗 Mon lien d&apos;inscription tracké
        </div>
        <div className="text-xs font-mono break-all text-gray-700 bg-white rounded p-2 border border-[#F6CCA4]/50">
          {link}
        </div>
      </div>
      <button
        onClick={copy}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#0A3855] text-white hover:bg-[#0d4f78] transition w-full sm:w-auto justify-center"
      >
        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? "Lien copié dans le presse-papier !" : (label || "Copier mon lien d'inscription")}
      </button>
      <p className="text-[11px] text-gray-600 leading-relaxed">
        ⚠️ <strong>Important</strong> : c&apos;est ce lien que vous devez transmettre à
        vos clients (et pas un lien Notion ou directement qlower.com sans UTM).
        Sans ce lien tracké, votre commission n&apos;est pas attribuée
        automatiquement.
      </p>
    </div>
  );
}
