"use client";

import { useState, useMemo } from "react";
import { Button, Card } from "@/components/ui";

interface HomePageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function HomePage({ onLogin, onRegister }: HomePageProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <HeroSection onLogin={onLogin} onRegister={onRegister} />

      {/* Simulator */}
      <SimulatorSection />

      {/* Why Join */}
      <WhyJoinSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Bottom CTA */}
      <BottomCTASection onLogin={onLogin} onRegister={onRegister} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* HERO                                                          */
/* ────────────────────────────────────────────────────────────── */
function HeroSection({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const checks = [
    "Commission sur chaque inscription",
    "Tableau de bord en temps reel",
    "Outils marketing fournis",
    "Support dedie partenaire",
  ];

  return (
    <section className="bg-[#FFF5ED] relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 py-20 sm:py-28 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
          {/* Text */}
          <div className="flex-1 mb-10 lg:mb-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#0A3855] flex items-center justify-center text-white font-bold text-lg shadow-md">
                Q
              </div>
              <span className="text-lg font-bold text-gray-900">
                Qlower <span className="font-normal text-gray-400">Pro</span>
              </span>
              <span className="text-xs bg-[#0A3855]/10 text-[#0A3855] px-2.5 py-0.5 rounded-full font-medium">
                Programme Partenaires
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
              Monetisez votre portefeuille en{" "}
              <span className="text-[#0A3855]">recommandant Qlower</span>{" "}
              a vos clients
            </h1>

            <p className="text-base sm:text-lg text-gray-500 mb-8 max-w-lg leading-relaxed">
              Rejoignez le programme partenaires Qlower et percevez des commissions sur
              chaque client qui souscrit via votre lien.
            </p>

            {/* Checks */}
            <ul className="space-y-3 mb-8">
              {checks.map((c) => (
                <li key={c} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {c}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="primary" className="px-6 py-3 text-base shadow-lg shadow-[#0A3855]/30" onClick={onRegister}>
                Devenir partenaire &mdash; gratuit
              </Button>
              <Button variant="outline" className="px-6 py-3 text-base" onClick={onLogin}>
                J&apos;ai deja un compte
              </Button>
            </div>
          </div>

          {/* Visual mock dashboard */}
          <div className="flex-1 max-w-md">
            <Card className="shadow-xl border-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenus du mois</span>
                  <span className="text-xs text-green-600 font-semibold">+24%</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">2&nbsp;480 &euro;</p>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">47</p>
                    <p className="text-[10px] text-gray-400">Leads</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#0A3855]">12</p>
                    <p className="text-[10px] text-gray-400">Abonnes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">8</p>
                    <p className="text-[10px] text-gray-400">Payeurs</p>
                  </div>
                </div>
                <div className="flex gap-1 h-20 items-end">
                  {[30, 45, 35, 60, 50, 75, 65, 80, 70, 90, 85, 95].map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#0A3855]/20 rounded-t"
                      style={{ height: `${v}%` }}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Decorative blurred circles */}
      <div className="absolute top-10 right-10 w-64 h-64 bg-[#0A3855]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-48 h-48 bg-amber-200/20 rounded-full blur-3xl" />
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* SIMULATOR                                                     */
/* ────────────────────────────────────────────────────────────── */
function SimulatorSection() {
  const [clients, setClients] = useState(20);
  const [convRate, setConvRate] = useState(20);

  const results = useMemo(() => {
    const abonnes = Math.round(clients * (convRate / 100));
    const commission = abonnes * 120;
    const annuel = commission * 12;
    return { abonnes, commission, annuel };
  }, [clients, convRate]);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Simulez vos revenus
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Estimez vos commissions en fonction du nombre de clients que vous recommandez.
          </p>
        </div>

        <Card className="shadow-lg" padding="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sliders */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Clients LMNP recommandes
                  </label>
                  <span className="text-sm font-bold text-[#0A3855] bg-[#0A3855]/10 px-2 py-0.5 rounded">
                    {clients}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={clients}
                  onChange={(e) => setClients(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0A3855]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>1</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Taux de conversion (%)
                  </label>
                  <span className="text-sm font-bold text-[#0A3855] bg-[#0A3855]/10 px-2 py-0.5 rounded">
                    {convRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={convRate}
                  onChange={(e) => setConvRate(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0A3855]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>5%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            {/* Result cards */}
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 font-medium mb-1">Abonnes estimes</p>
                <p className="text-2xl font-bold text-gray-900">{results.abonnes}</p>
              </div>
              <div className="bg-[#0A3855]/5 rounded-xl p-4 text-center">
                <p className="text-xs text-[#0A3855] font-medium mb-1">Commission mensuelle</p>
                <p className="text-2xl font-bold text-[#0A3855]">
                  {results.commission.toLocaleString("fr-FR")} &euro;
                </p>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 font-medium mb-1">Revenu annuel estime</p>
                <p className="text-2xl font-bold text-white">
                  {results.annuel.toLocaleString("fr-FR")} &euro;
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* WHY JOIN                                                      */
/* ────────────────────────────────────────────────────────────── */
function WhyJoinSection() {
  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Commissions attractives",
      description:
        "Percevez des commissions recurrentes sur chaque client actif. Plus vos clients sont fideles, plus vos revenus augmentent.",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Dashboard en temps reel",
      description:
        "Suivez vos leads, conversions et revenus en direct. Visualisez vos performances et optimisez votre strategie.",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      title: "Support dedie",
      description:
        "Un Customer Success Manager vous accompagne pour maximiser vos conversions avec des outils et conseils personnalises.",
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Pourquoi rejoindre le programme ?
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Tout ce dont vous avez besoin pour generer des revenus complementaires.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} padding="lg" className="text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#0A3855]/10 flex items-center justify-center text-[#0A3855] mx-auto mb-4">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* HOW IT WORKS                                                  */
/* ────────────────────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { num: 1, title: "Inscription", desc: "Creez votre compte partenaire en 2 minutes. Coline vous contacte pour finaliser." },
    { num: 2, title: "Recevez votre kit", desc: "Lien affilie, code promo, templates email — tout de suite apres signature." },
    { num: 3, title: "Partagez", desc: "3 options : lien direct, formulaire de contact ou lien de RDV." },
    { num: 4, title: "Gagnez", desc: "Commission fixe versee pour chaque 1re souscription de vos clients." },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Comment ca marche ?
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            4 etapes simples pour commencer a generer des revenus.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="relative text-center">
              <div className="w-10 h-10 rounded-full bg-[#0A3855] text-white font-bold text-sm flex items-center justify-center mx-auto mb-4 shadow-md">
                {s.num}
              </div>
              {/* Connector line between steps */}
              {s.num < 4 && (
                <div className="hidden lg:block absolute top-5 left-[calc(50%+24px)] w-[calc(100%-48px)] h-px bg-gray-200" />
              )}
              <h3 className="text-sm font-bold text-gray-900 mb-1">{s.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* TESTIMONIALS                                                  */
/* ────────────────────────────────────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Qlower Pro m'a permis de generer un revenu complementaire significatif tout en apportant une vraie valeur a mes clients investisseurs.",
      name: "Marie D.",
      role: "CGP - Paris",
    },
    {
      quote: "Le dashboard est super clair, je suis mes conversions en temps reel. Le support est reactif et les commissions tombent chaque mois.",
      name: "Thomas L.",
      role: "Agent immobilier - Lyon",
    },
    {
      quote: "En 3 mois, j'ai deja 25 clients actifs sur Qlower. Le programme est simple et rentable.",
      name: "Sophie M.",
      role: "Courtiere - Bordeaux",
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Ils nous font confiance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} padding="lg" className="hover:shadow-md transition-shadow">
              {/* Stars */}
              <div className="flex gap-0.5 mb-3 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-sm font-bold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* BOTTOM CTA                                                    */
/* ────────────────────────────────────────────────────────────── */
function BottomCTASection({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <section className="py-20 bg-gradient-to-br from-[#0A3855] to-[#3a7199]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
          Rejoignez l&apos;ecosysteme Qlower
        </h2>
        <p className="text-sm text-white/80 mb-8 max-w-md mx-auto leading-relaxed">
          Gestionnaire, conciergerie, agent, CGP, experts-comptables : aidons vos clients
          a payer moins d&apos;impots.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={onRegister}
            className="px-8 py-3 rounded-xl bg-[#F6CCA4] text-[#1C1C1C] text-sm font-bold cursor-pointer hover:bg-[#F5C89A] transition shadow-lg"
          >
            Creer mon espace partenaire
          </button>
          <button
            onClick={onLogin}
            className="px-8 py-3 rounded-xl border border-white/50 bg-white/15 text-white text-sm font-medium cursor-pointer hover:bg-white/25 transition"
          >
            Se connecter
          </button>
        </div>
        <p className="text-xs text-white/60 mt-5">
          Inscription gratuite &middot; Aucun engagement &middot; Support inclus
        </p>
      </div>
    </section>
  );
}
