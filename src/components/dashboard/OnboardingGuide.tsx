"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, Button } from "@/components/ui";
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
  const router = useRouter();
  const [doneSteps, setDoneSteps] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("guide_done_steps");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [expandedStep, setExpandedStep] = useState<string>("kit");

  const signupLink = buildSignupLink(utm, code);

  // Persist doneSteps to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("guide_done_steps", JSON.stringify([...doneSteps]));
    if (doneSteps.size === 4) {
      localStorage.setItem("guide_completed", "true");
    }
  }, [doneSteps]);

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
      title: "Télécharger le kit partenaire",
      description: "Logos, présentations et supports de communication",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Téléchargez votre kit de communication contenant les logos Qlower, les slides de
            présentation et les templates d&apos;emails pour contacter vos clients.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="default" className="text-xs" onClick={() => router.push("/dashboard/kit")}>
              Accéder au kit
            </Button>
            <button
              className="text-xs text-[#0A3855]/60 hover:text-[#0A3855] underline underline-offset-2 transition-colors"
              onClick={() => markDone("kit")}
            >
              Marquer comme fait
            </button>
          </div>
        </div>
      ),
    },
    {
      id: "video",
      title: "Regarder la vidéo de présentation",
      description: "3 min pour comprendre Qlower et savoir le présenter",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Découvrez en 3 minutes comment Qlower aide vos clients à gérer leur fiscalité immobilière
            et comment en parler efficacement.
          </p>
          <div className="bg-gradient-to-br from-[#E5EDF1] to-[#E5EDF1]/40 rounded-xl h-40 flex items-center justify-center mb-3 border border-[#E5EDF1]">
            <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-[#0A3855] ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <button
            className="text-xs text-[#0A3855]/60 hover:text-[#0A3855] underline underline-offset-2 transition-colors"
            onClick={() => markDone("video")}
          >
            Marquer comme fait
          </button>
        </div>
      ),
    },
    {
      id: "referral",
      title: "Partager votre lien d'inscription",
      description: "Envoyez votre lien unique à votre premier contact",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Copiez votre lien et partagez-le à un contact pour commencer à générer des leads.
          </p>
          <div className="bg-[#E5EDF1]/40 border border-[#E5EDF1] rounded-xl p-3.5 flex items-center gap-3 flex-wrap">
            <code className="text-xs text-[#0A3855]/70 break-all flex-1 min-w-0">{signupLink}</code>
            <CopyButton text={signupLink} label="Copier" />
          </div>
          <button
            className="text-xs text-[#0A3855]/60 hover:text-[#0A3855] underline underline-offset-2 transition-colors"
            onClick={() => markDone("referral")}
          >
            Marquer comme fait
          </button>
        </div>
      ),
    },
    {
      id: "rdv",
      title: "Prendre un premier rendez-vous",
      description: "Planifier un appel pour optimiser votre stratégie",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Planifiez un appel avec notre responsable des partenariats pour
            personnaliser votre approche et maximiser vos conversions.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="default"
              className="text-xs"
              onClick={() => window.open(`https://meetings-eu1.hubspot.com/qlower/accompagnement-declaration-fiscale-decouverte-qlower?utm_source=${utm}`, "_blank")}
            >
              Prendre RDV
            </Button>
            <button
              className="text-xs text-[#0A3855]/60 hover:text-[#0A3855] underline underline-offset-2 transition-colors"
              onClick={() => markDone("rdv")}
            >
              Marquer comme fait
            </button>
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
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* Welcome Header - Gradient Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#0A3855]/80 p-6 sm:p-8 mb-6 shadow-lg shadow-[#0A3855]/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-white/50 font-semibold uppercase tracking-widest mb-1">Bienvenue</p>
            <h1 className="text-2xl font-bold text-white mb-1">
              {partnerName}
            </h1>
            <p className="text-sm text-white/60">
              Suivez ces étapes pour bien démarrer votre partenariat Qlower.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative w-16 h-16">
              {/* Background circle */}
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPct / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                {progressPct}%
              </span>
            </div>
            <span className="text-[10px] text-white/40 font-medium">{completedCount}/{totalSteps} étapes</span>
          </div>
        </div>
        {/* Animated progress bar */}
        <div className="mt-5 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#F6CCA4] to-[#F6CCA4]/70 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Celebration */}
      {allDone && (
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border border-emerald-200/60 p-8 text-center shadow-sm">
          <div className="relative inline-block mb-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {/* Confetti dots */}
            <div className="absolute -top-1 -left-2 w-2 h-2 rounded-full bg-[#F6CCA4] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="absolute -top-2 right-0 w-1.5 h-1.5 rounded-full bg-[#0A3855]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="absolute top-0 -right-3 w-2.5 h-2.5 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: "300ms" }} />
            <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full bg-[#F6CCA4]/60 animate-bounce" style={{ animationDelay: "200ms" }} />
          </div>
          <h2 className="text-lg font-bold text-emerald-800 mb-1">Félicitations !</h2>
          <p className="text-sm text-emerald-700/80 mb-5 max-w-sm mx-auto">
            Vous avez complété toutes les étapes. Vous êtes prêt à suivre vos leads.
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-md shadow-emerald-600/20" onClick={onDone}>
            Acceder au tableau de bord
          </Button>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isDone = doneSteps.has(step.id);
          const isExpanded = expandedStep === step.id;
          const isCurrent = !isDone && !allDone;

          return (
            <div
              key={step.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isDone
                  ? "bg-gray-50/80 border-gray-100 opacity-70"
                  : isExpanded
                    ? "bg-white border-[#0A3855]/15 shadow-md shadow-[#0A3855]/5"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedStep(isExpanded ? "" : step.id)}
              >
                {/* Circle indicator */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-100 text-emerald-600"
                      : isCurrent && isExpanded
                        ? "bg-[#0A3855] text-white shadow-md shadow-[#0A3855]/30"
                        : isCurrent
                          ? "bg-[#E5EDF1] text-[#0A3855] ring-2 ring-[#0A3855]/20"
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
                  <p className="text-xs text-gray-400 truncate mt-0.5">{step.description}</p>
                </div>

                {/* Chevron */}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
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
                <div className="px-5 pb-5 pl-[4.25rem]">
                  <div className="border-t border-gray-100 pt-4">
                    {step.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skip link */}
      {!allDone && (
        <div className="text-center mt-8">
          <button
            className="text-xs text-gray-400 hover:text-[#0A3855] transition-colors group"
            onClick={onDone}
          >
            <span className="group-hover:underline underline-offset-2">Passer le guide et aller au tableau de bord</span>
            <svg className="inline-block w-3 h-3 ml-1 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
