"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Lock, Copy, CheckCircle2 } from "lucide-react";
import { usePartnerContext } from "@/app/dashboard/layout";
import { buildSignupLink } from "@/services/links";
import ShareSignupButton from "@/components/partner/ShareSignupButton";

interface EmailTemplate {
  id: string;
  title: string;
  context: string;
  subject: string;
  body: string; // {LINK} placeholder gets replaced with the signup URL
}

const TEMPLATES: EmailTemplate[] = [
  {
    id: "intro",
    title: "Email d'introduction",
    context: "Premier email après que vous avez parlé de Qlower au client",
    subject: "Qlower — l'outil fiscal LMNP/SCI dont je vous parlais",
    body: `Bonjour,

Suite à notre échange, voici le lien direct pour découvrir Qlower et créer votre compte :

{LINK}

Qlower va automatiser pour vous :
- la déclaration fiscale LMNP / LMP / SCI ;
- le suivi des amortissements et la comptabilité année après année ;
- la production de la liasse fiscale prête à transmettre.

L'inscription prend 2 minutes. Je reste disponible si vous avez la moindre question.

Bien cordialement`,
  },
  {
    id: "relance",
    title: "Email de relance (J+7)",
    context: "Si le client n'a pas encore créé son compte une semaine après",
    subject: "Petit rappel — votre simulation Qlower",
    body: `Bonjour,

Je voulais m'assurer que vous avez bien reçu le lien Qlower que je vous ai transmis la semaine dernière.

Voici le lien pour créer votre compte :
{LINK}

Si vous avez besoin d'aide pour la création du compte, n'hésitez pas à me revenir — je peux faire le pas à pas avec vous en 5 minutes.

Bien cordialement`,
  },
  {
    id: "fin-annee",
    title: "Email de fin d'année (anti-pénalités)",
    context: "À envoyer en novembre/décembre aux clients qui n'ont pas encore souscrit",
    subject: "Déclaration fiscale 2026 : il est encore temps",
    body: `Bonjour,

L'année fiscale touche à sa fin et je sais que la déclaration peut représenter un vrai casse-tête pour les bailleurs LMNP / SCI.

Qlower vous fait gagner du temps et évite les erreurs (qui coûtent cher en pénalités). L'outil reprend même les années précédentes en un clic.

Vous pouvez créer votre compte ici : {LINK}

À votre disposition,`,
  },
];

export default function EmailsPage() {
  const { partner } = usePartnerContext();
  const link = buildSignupLink(partner.utm || "", partner.code || null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyTemplate(t: EmailTemplate) {
    const filled = t.body.replace(/\{LINK\}/g, link);
    const fullText = `Sujet : ${t.subject}\n\n${filled}`;
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = fullText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2200);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link href="/dashboard/kit" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]">
        <ArrowLeft className="w-3 h-3" /> Retour à la boîte à outils
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#0A3855]">Templates d&apos;emails clients</h1>
        <p className="text-sm text-gray-500 mt-1">
          Emails prêts à envoyer — chaque template inclut automatiquement votre
          lien d&apos;inscription tracké.
        </p>
      </div>

      <ShareSignupButton compact label="Copier mon lien d'inscription seul" />

      <div className="space-y-4">
        {TEMPLATES.map((t) => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#0A3855]">{t.title}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{t.context}</p>
              </div>
              <button
                onClick={() => copyTemplate(t)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#0A3855] text-white hover:bg-[#0d4f78] flex-shrink-0"
              >
                {copiedId === t.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === t.id ? "Copié !" : "Copier"}
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              <div className="font-semibold text-[#0A3855] mb-2 not-italic">Sujet : {t.subject}</div>
              {t.body.replace(/\{LINK\}/g, link)}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <h2 className="text-base font-semibold text-[#0A3855] flex items-center gap-2">
          <Lock className="w-4 h-4" /> Pour vous (interne)
        </h2>
        <p className="text-xs text-gray-600">
          Plus de templates et de variations sur Notion. <strong>Ne pas partager
          directement au client</strong> — copiez le contenu et collez-le dans
          un email avec votre lien tracké ci-dessus.
        </p>
        <a
          href="https://www.notion.so/qlower/Kit-fiscal-partenaire-Qlower"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-[#0A3855]"
        >
          Kit fiscal complet sur Notion <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
