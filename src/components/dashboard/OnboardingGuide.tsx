"use client";

import { useState, useCallback } from "react";
import { Card, Button } from "@/components/ui";
import { buildSignupLink } from "@/services/links";
import { CopyButton } from "@/components/ui";

interface OnboardingGuideProps {
  partnerName: string;
  code: string;
  utm: string;
  onDone: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
}

export function OnboardingGuide({ partnerName, code, utm, onDone }: OnboardingGuideProps) {
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [expandedStep, setExpandedStep] = useState<string>("kit");

  const signupLink = buildSignupLink(utm, code);

  const markDone = useCallback(
    (stepId: string) => {
      setDoneSteps((prev) => {
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });
    },
    []
  );

  const steps: Step[] = [
    {
      id: "kit",
      title: "Telecharger le kit partenaire",
      description: "Logos, presentations et supports de communication",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Telechargez votre kit de communication contenant les logos Qlower, les slides de
            presentation et les templates d&apos;emails pour contacter vos clients.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" className="text-xs">
              Telecharger le kit
            </Button>
            <Button variant="ghost" className="text-xs" onClick={() => markDone("kit")}>
              Marquer comme fait
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: "video",
      title: "Regarder la video de presentation",
      description: "3 min pour comprendre Qlower et savoir le presenter",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Decouvrez en 3 minutes comment Qlower aide vos clients a gerer leur fiscalite immobiliere
            et comment en parler efficacement.
          </p>
          <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center mb-3">
            <span className="text-3xl">&#x25B6;&#xFE0F;</span>
          </div>
          <Button variant="ghost" className="text-xs" onClick={() => markDone("video")}>
            Marquer comme fait
          </Button>
        </div>
      ),
    },
    {
      id: "referral",
      title: "Partager votre lien d'inscription",
      description: "Envoyez votre lien unique a votre premier contact",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Copiez votre lien et partagez-le a un contact pour commencer a generer des leads.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 flex-wrap">
            <code className="text-xs text-gray-600 break-all flex-1 min-w-0">{signupLink}</code>
            <CopyButton text={signupLink} label="Copier" />
          </div>
          <Button variant="ghost" className="text-xs" onClick={() => markDone("referral")}>
            Marquer comme fait
          </Button>
        </div>
      ),
    },
    {
      id: "rdv",
      title: "Prendre un RDV avec Coline",
      description: "Planifier un appel pour optimiser votre strategie",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Planifiez un appel de 15 min avec Coline, votre Customer Success Manager, pour
            personnaliser votre approche et maximiser vos conversions.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              className="text-xs"
              onClick={() => window.open(`https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower?utm_source=${utm}`, "_blank")}
            >
              Prendre RDV
            </Button>
            <Button variant="ghost" className="text-xs" onClick={() => markDone("rdv")}>
              Marquer comme fait
            </Button>
          </div>
        </div>
      ),
    },
  ];

  const completedCount = doneSteps.size;
  const totalSteps = steps.length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);
  const allDone = completedCount === totalSteps;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Bienvenue, {partnerName} !
        </h1>
        <p className="text-sm text-gray-500">
          Suivez ces etapes pour bien demarrer votre partenariat Qlower.
        </p>
      </div>

      {/* Progress Bar */}
      <Card className="mb-6" padding="sm">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-gray-700">Progression</span>
          <span className="text-xs font-bold text-[#0A3855]">{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0A3855] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          {completedCount} sur {totalSteps} etapes completees
        </p>
      </Card>

      {/* Celebration */}
      {allDone && (
        <Card className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200" padding="lg">
          <div className="text-center">
            <div className="text-4xl mb-2">&#x1F389;</div>
            <h2 className="text-lg font-bold text-green-800 mb-1">Felicitations !</h2>
            <p className="text-sm text-green-700 mb-4">
              Vous avez complete toutes les etapes. Vous etes pret a suivre vos leads.
            </p>
            <Button variant="success" onClick={onDone}>
              Acceder au tableau de bord
            </Button>
          </div>
        </Card>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isDone = doneSteps.has(step.id);
          const isExpanded = expandedStep === step.id;
          const isCurrent = !isDone && !allDone;

          return (
            <Card key={step.id} padding="sm" className={isDone ? "opacity-75" : ""}>
              <button
                className="w-full flex items-center gap-3 px-2 py-2 text-left"
                onClick={() => setExpandedStep(isExpanded ? "" : step.id)}
              >
                {/* Circle indicator */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                    isDone
                      ? "bg-green-100 text-green-600"
                      : isCurrent
                        ? "bg-[#0A3855]/10 text-[#0A3855] ring-2 ring-[#0A3855]/30"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isDone ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{step.description}</p>
                </div>

                {/* Chevron */}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-2 pb-3 pl-12">
                  {step.content}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Skip link */}
      {!allDone && (
        <div className="text-center mt-6">
          <button
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
            onClick={onDone}
          >
            Passer le guide et aller au tableau de bord
          </button>
        </div>
      )}
    </div>
  );
}
