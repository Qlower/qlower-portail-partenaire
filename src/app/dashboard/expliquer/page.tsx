"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Lock, Play, FileText } from "lucide-react";
import ShareSignupButton from "@/components/partner/ShareSignupButton";

/**
 * Page "Expliquer Qlower à ses clients" — remplace le lien Notion direct.
 *
 * Le but : éviter qu'un partenaire envoie le lien Notion à son client
 * (puis perte d'attribution). Cette page contient la version "client-ready"
 * avec le lien d'inscription pré-tracké, et le lien Notion reste dispo
 * mais marqué comme RESSOURCE INTERNE (à ne pas partager).
 */
export default function ExpliquerPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link href="/dashboard/kit" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A3855]">
        <ArrowLeft className="w-3 h-3" /> Retour à la boîte à outils
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#0A3855]">Expliquer Qlower à vos clients</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tout ce qu&apos;il faut pour présenter Qlower et faciliter la souscription —
          avec votre lien d&apos;inscription tracké pour ne perdre aucune attribution.
        </p>
      </div>

      {/* CTA principal — bouton de partage */}
      <ShareSignupButton />

      {/* Ressources à transmettre au client */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-[#0A3855]">📤 À transmettre à votre client</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <a
            href="https://youtu.be/Z6mlC-RP_ss"
            target="_blank"
            rel="noreferrer"
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-[#0A3855]/40 transition"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Play className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Démo produit (vidéo)</h3>
                <p className="text-xs text-gray-500 mt-1">5 min — interface Qlower expliquée</p>
                <span className="text-xs text-[#0A3855] mt-2 inline-flex items-center gap-1">
                  YouTube <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </a>

          <a
            href="https://drive.google.com/file/d/17xTVPzA8_WzgSaHMlPf5Y37imgtHBJCW/view"
            target="_blank"
            rel="noreferrer"
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-[#0A3855]/40 transition"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Plaquette B2C</h3>
                <p className="text-xs text-gray-500 mt-1">PDF prêt à envoyer</p>
                <span className="text-xs text-[#0A3855] mt-2 inline-flex items-center gap-1">
                  Google Drive <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* Argumentaire pour le partenaire (interne) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="text-base font-semibold text-[#0A3855] flex items-center gap-2">
          <Lock className="w-4 h-4" /> Pour vous (interne)
        </h2>
        <p className="text-xs text-gray-600">
          Argumentaire commercial complet, FAQ, objections types — utile pour
          préparer vos rendez-vous client. <strong>Ne pas partager directement
          au client</strong> car ce lien ne contient pas votre tracking.
        </p>
        <a
          href="https://www.notion.so/qlower/Expliquer-Qlower-ses-clients-comment-y-souscrire-6b4eee4ecb4e48dc8cf64b026681a9d5"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-[#0A3855]"
        >
          Argumentaire complet sur Notion <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
