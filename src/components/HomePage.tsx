"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface HomePageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function HomePage({ onLogin, onRegister }: HomePageProps) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar onLogin={onLogin} onRegister={onRegister} />
      <HeroSection onRegister={onRegister} />
      <LogoBar />
      <SimulatorSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CtaSection onRegister={onRegister} />
      <Footer />
    </div>
  );
}

/* ─── Navbar ──────────────────────────────────────────────────── */
function Navbar({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0A3855] flex items-center justify-center text-white font-bold text-base shadow-sm">
            Q
          </div>
          <span className="text-base font-bold text-gray-900">
            Qlower <span className="font-normal text-gray-400">Pro</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onLogin} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5">
            Se connecter
          </button>
          <Button onClick={onRegister} size="sm">
            Devenir partenaire
          </Button>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────────── */
function HeroSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFF5ED] via-white to-[#E5EDF1]/40" />
      <div className="absolute top-20 right-[10%] w-[500px] h-[500px] bg-[#F6CCA4]/15 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-[5%] w-[400px] h-[400px] bg-[#0A3855]/5 rounded-full blur-[100px]" />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-28 sm:pt-28 sm:pb-36">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-20">
          {/* Text */}
          <div className="flex-1 mb-14 lg:mb-0">
            <Badge variant="secondary" className="mb-6 px-3 py-1 text-xs font-medium bg-[#0A3855]/8 text-[#0A3855] border-0">
              Programme Partenaires 2026
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Générez des revenus en recommandant{" "}
              <span className="bg-gradient-to-r from-[#0A3855] to-[#0A3855]/70 bg-clip-text text-transparent">
                Qlower
              </span>{" "}
              à vos clients
            </h1>

            <p className="text-lg text-gray-500 mb-4 max-w-lg leading-relaxed">
              Rejoignez le programme partenaires et percevez une commission sur chaque client qui souscrit à Qlower via votre lien.
            </p>

            <div className="bg-[#E5EDF1]/60 border border-[#0A3855]/10 rounded-xl px-5 py-4 mb-6 max-w-lg">
              <p className="text-xs font-semibold text-[#0A3855] mb-1.5 uppercase tracking-wider">Qu'est-ce que Qlower ?</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Qlower est la solution de gestion fiscale et comptable dédiée aux investisseurs immobiliers LMNP, SCI et revenus fonciers. Elle automatise les déclarations, calcule les amortissements et accompagne chaque bailleur tout au long de l'année — sans expertise comptable requise.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 bg-[#FFF5ED] border border-[#F6CCA4]/40 rounded-xl px-4 py-2.5 mb-6 text-sm">
              <span className="text-[#F6CCA4] text-base">🎁</span>
              <span className="text-gray-700">Vos clients bénéficient de <strong className="text-[#0A3855]">−20€</strong> à l'inscription via votre code promo</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap mb-10">
              <Button onClick={onRegister} size="lg" className="px-8 py-3 text-base shadow-lg shadow-[#0A3855]/20">
                Commencer gratuitement
              </Button>
              <span className="text-xs text-gray-400">
                Gratuit · Sans engagement · 2 min
              </span>
            </div>

            {/* Trust signals */}
            <div className="flex items-center gap-6 text-sm text-gray-500">
              {[
                { val: "100€", label: "par souscription" },
                { val: "100+", label: "partenaires actifs" },
                { val: "20%", label: "taux moyen" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[#0A3855]">{s.val}</span>
                  <span className="text-xs text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              {/* Glow behind card */}
              <div className="absolute -inset-4 bg-gradient-to-br from-[#0A3855]/10 to-[#F6CCA4]/10 rounded-3xl blur-2xl" />
              <Card className="relative shadow-2xl shadow-black/5 border-0 bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Revenus du mois</span>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+24%</span>
                  </div>
                  <p className="text-3xl font-extrabold text-gray-900 mb-4">2&nbsp;480&nbsp;€</p>
                  <Separator className="mb-4" />
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { val: "47", label: "Leads", color: "text-gray-900" },
                      { val: "12", label: "Abonnés", color: "text-[#0A3855]" },
                      { val: "8", label: "Payeurs", color: "text-green-600" },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-[3px] h-16 items-end">
                    {[30, 45, 35, 60, 50, 75, 65, 80, 70, 90, 85, 95].map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-[#0A3855]/30 to-[#0A3855]/10"
                        style={{ height: `${v}%` }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo bar ────────────────────────────────────────────────── */
function LogoBar() {
  return (
    <section className="py-8 border-y border-gray-100 bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
          Déjà plus de
        </p>
        <p className="text-3xl font-extrabold text-[#0A3855] mb-1">100+</p>
        <p className="text-sm text-gray-500">partenaires actifs partout en France</p>
        <p className="text-xs text-gray-400 mt-1">CGP · Agents immobiliers · Courtiers · Conciergeries · Proptech · Banques</p>
      </div>
    </section>
  );
}

/* ─── Simulator ───────────────────────────────────────────────── */
function SimulatorSection() {
  const [clients, setClients] = useState(20);
  const [convRate, setConvRate] = useState(20);

  const results = useMemo(() => {
    const abonnes = Math.round(clients * (convRate / 100));
    const annuel = abonnes * 100;
    const commission = Math.round(annuel / 12);
    return { abonnes, commission, annuel };
  }, [clients, convRate]);

  return (
    <section className="py-24 bg-white" id="simulateur">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs bg-[#F6CCA4]/20 text-[#0A3855] border-0">
            Simulateur
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Estimez vos revenus
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Déplacez les curseurs pour voir combien vous pouvez générer.
          </p>
        </div>

        <Card className="shadow-xl shadow-black/5 border-0">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Sliders */}
              <div className="space-y-8">
                <SliderField
                  label="Clients LMNP dans votre portefeuille"
                  value={clients}
                  onChange={setClients}
                  min={1}
                  max={100}
                  display={String(clients)}
                />
                <SliderField
                  label="Taux de conversion estimé"
                  value={convRate}
                  onChange={setConvRate}
                  min={5}
                  max={50}
                  display={`${convRate}%`}
                />
              </div>

              {/* Results */}
              <div className="flex flex-col gap-3">
                <ResultCard label="Clients convertis" value={String(results.abonnes)} variant="light" />
                <ResultCard label="Équivalent mensuel" value={`${results.commission.toLocaleString("fr-FR")} €`} variant="primary" />
                <ResultCard label="Commission annuelle estimée" value={`${results.annuel.toLocaleString("fr-FR")} €`} variant="dark" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function SliderField({ label, value, onChange, min, max, display }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; display: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <span className="text-sm font-bold text-[#0A3855] bg-[#0A3855]/8 px-2.5 py-0.5 rounded-md">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ResultCard({ label, value, variant }: { label: string; value: string; variant: "light" | "primary" | "dark" }) {
  const styles = {
    light: "bg-gray-50 text-gray-900",
    primary: "bg-[#E5EDF1] text-[#0A3855]",
    dark: "bg-gradient-to-br from-[#0A3855] to-[#0A3855]/90 text-white",
  };
  const labelColor = { light: "text-gray-400", primary: "text-[#0A3855]/60", dark: "text-white/60" };

  return (
    <div className={`rounded-xl p-5 text-center ${styles[variant]}`}>
      <p className={`text-[11px] font-medium mb-1.5 ${labelColor[variant]}`}>{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </div>
  );
}

/* ─── Features ────────────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: "💰",
      title: "Commission à la souscription",
      desc: "100€ par client qui souscrit via votre lien. Versement annuel garanti.",
    },
    {
      icon: "📊",
      title: "Dashboard temps réel",
      desc: "Suivez vos leads, conversions et commissions. Données synchronisées avec HubSpot.",
    },
    {
      icon: "🔗",
      title: "3 façons de référer",
      desc: "Lien d'inscription, formulaire de contact ou lien de prise de RDV. À vous de choisir.",
    },
    {
      icon: "🧰",
      title: "Kit marketing complet",
      desc: "Templates email, argumentaire, code promo personnalisé et agenda fiscal.",
    },
    {
      icon: "🤝",
      title: "Support dédié",
      desc: "Coline, votre contact partenariat, vous accompagne pour maximiser vos conversions.",
    },
    {
      icon: "📈",
      title: "Benchmark anonyme",
      desc: "Comparez votre taux de conversion avec la moyenne de votre secteur d'activité.",
    },
  ];

  return (
    <section className="py-24 bg-gray-50/80">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Des outils pensés pour les professionnels de l&apos;immobilier.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <Card key={f.title} className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { icon: "📝", title: "Inscrivez-vous", desc: "Créez votre compte en 2 minutes. Coline vous contacte sous 48h." },
    { icon: "📦", title: "Recevez votre kit", desc: "Lien affilié, code promo, templates email — tout est prêt." },
    { icon: "📤", title: "Partagez", desc: "Lien direct, formulaire ou RDV. 3 façons de référer vos clients." },
    { icon: "💶", title: "Gagnez", desc: "100€ par 1ère souscription. Versement annuel automatique." },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Comment ça marche ?
          </h2>
          <p className="text-sm text-gray-500">
            4 étapes simples pour commencer à générer des revenus.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center group">
              {/* Connector */}
              {i < 3 && (
                <div className="hidden lg:block absolute top-7 left-[calc(50%+28px)] w-[calc(100%-56px)] border-t-2 border-dashed border-gray-200" />
              )}
              <div className="w-14 h-14 rounded-2xl bg-[#0A3855] text-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#0A3855]/20 group-hover:scale-105 transition-transform">
                {s.icon}
              </div>
              <div className="text-[10px] font-bold text-[#0A3855] mb-2">ÉTAPE {i + 1}</div>
              <h3 className="text-sm font-bold text-gray-900 mb-1.5">{s.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ────────────────────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Qlower Pro m'a permis de générer un revenu complémentaire significatif tout en apportant une vraie valeur à mes clients investisseurs.",
      name: "Marie D.",
      role: "CGP",
      city: "Paris",
      metric: "12 clients référés",
    },
    {
      quote: "Le dashboard est super clair, je suis mes conversions en temps réel. Le support est réactif et les commissions tombent chaque année.",
      name: "Thomas L.",
      role: "Agent immobilier",
      city: "Lyon",
      metric: "24% de conversion",
    },
    {
      quote: "En 3 mois, j'ai déjà 25 clients actifs sur Qlower. Le programme est simple et rentable.",
      name: "Sophie M.",
      role: "Courtière",
      city: "Bordeaux",
      metric: "2 500€ de commissions",
    },
  ];

  return (
    <section className="py-24 bg-[#FFF5ED]/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
            Ils nous font confiance
          </h2>
          <p className="text-sm text-gray-500">Plus de 100 partenaires actifs dans toute la France.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} className="hover:shadow-lg transition-shadow border-0 shadow-sm">
              <CardContent className="p-6 flex flex-col h-full">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4 text-[#F6CCA4]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-5 flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role} · {t.city}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-[#E5EDF1] text-[#0A3855] border-0">
                    {t.metric}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─────────────────────────────────────────────────────── */
function CtaSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative bg-[#0A3855] rounded-3xl px-8 py-16 sm:px-16 text-center overflow-hidden">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#F6CCA4]/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
              Prêt à rejoindre l&apos;écosystème Qlower ?
            </h2>
            <p className="text-sm text-white/70 mb-8 max-w-md mx-auto leading-relaxed">
              CGP, agents immobiliers, courtiers, conciergeries, proptech, banques, experts-comptables — créez votre espace partenaire en 2 minutes.
            </p>
            <button
              onClick={onRegister}
              className="px-8 py-3.5 rounded-xl bg-[#F6CCA4] text-[#0A3855] text-sm font-bold cursor-pointer hover:bg-[#F5C89A] transition-all shadow-lg shadow-black/20 hover:shadow-xl hover:-translate-y-0.5"
            >
              Créer mon espace partenaire — gratuit
            </button>
            <p className="text-xs text-white/40 mt-5">
              Inscription gratuite · Aucun engagement · Support inclus
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#0A3855] flex items-center justify-center text-white text-xs font-bold">Q</div>
          <span className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Qlower. Tous droits réservés.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Connexion</Link>
          <Link href="/register" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Inscription</Link>
        </div>
      </div>
    </footer>
  );
}
