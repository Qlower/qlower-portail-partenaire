"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Wand2, Upload, CloudUpload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardPartner } from "@/hooks/useMutations";
import { isValidEmail, slug } from "@/services/links";
import { METIERS } from "@/services/constants";
import { DEFAULT_TRANCHES } from "@/services/commission";
import { useCreatePartner } from "@/hooks/useAdminData";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Compte", "Société", "Documents", "Contrat", "RIB", "Finalisation"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

interface FormData {
  prenom: string; nom: string; email: string; password: string; passwordConfirm: string;
  company: string; metier: string; siret: string; tva: string; address: string;
  city: string; postalCode: string; contactEmail: string; contactPhone: string;
  kbisFile: File | null; promoCode: string; iban: string; bic: string;
}

const initial: FormData = {
  prenom: "", nom: "", email: "", password: "", passwordConfirm: "",
  company: "", metier: METIERS[0], siret: "", tva: "", address: "",
  city: "", postalCode: "", contactEmail: "", contactPhone: "",
  kbisFile: null, promoCode: "", iban: "", bic: "",
};

export default function RegisterForm() {
  const { signUp, supabase } = useAuth();
  const onboard = useOnboardPartner();
  const createPartner = useCreatePartner();
  const router = useRouter();

  const [step, setStep] = useState<StepIndex>(0);
  const [form, setForm] = useState<FormData>(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.prenom || !form.nom) return "Prénom et nom requis.";
      if (!isValidEmail(form.email)) return "Email invalide.";
      if (form.password.length < 6) return "Mot de passe : 6 caractères minimum.";
      if (form.password !== form.passwordConfirm) return "Les mots de passe ne correspondent pas.";
      if (!form.company) return "Nom de société requis.";
    }
    if (step === 1 && (!form.siret || !form.address || !form.city || !form.postalCode)) {
      return "Adresse complète et SIRET requis.";
    }
    if (step === 2 && !form.promoCode) return "Code promo requis.";
    if (step === 4 && (!form.iban || !form.bic)) return "IBAN et BIC requis.";
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(s + 1, 5) as StepIndex);
  };

  const prev = () => { setError(""); setStep((s) => Math.max(s - 1, 0) as StepIndex); };

  const handleFinish = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const partnerId = slug(form.company || "nouveau") + "-" + Date.now().toString().slice(-4);
    const utm = slug(form.company || "nouveau");
    const code = form.promoCode || (form.company.toUpperCase().replace(/\s/g, "").slice(0, 4) + "20");

    try {
      await signUp(form.email, form.password, {
        first_name: form.prenom, last_name: form.nom,
        company: form.company, metier: form.metier, partner_id: partnerId,
      });

      await createPartner.mutateAsync({
        id: partnerId, nom: form.company || `${form.prenom} ${form.nom}`,
        email: form.email, type: "autre", contrat: "affiliation", code, utm,
        comm_rules: [
          { type: "annuelle", montant: 100, actif: true },
          { type: "souscription", montant: 0, actif: false },
          { type: "biens", tranches: DEFAULT_TRANCHES(), actif: false },
          { type: "pct_ca", pct: 0, actif: false },
        ],
      });

      await supabase.auth.updateUser({ data: { partner_id: partnerId } });
      onboard.mutateAsync({ partnerName: form.company, utmValue: utm }).catch(() => {});
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  const autoCode = () => {
    const b = (form.nom || form.company || "").toUpperCase().replace(/\s/g, "").slice(0, 4);
    if (b) set("promoCode", b + "20");
  };

  // ── Progress ──────────────────────────────────────────────
  const renderProgress = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
              i < step ? "bg-green-500 text-white" :
              i === step ? "bg-[#0A3855] text-white ring-4 ring-[#0A3855]/15" :
              "bg-muted text-muted-foreground"
            )}>
              {i < step ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={cn(
              "text-[10px] mt-1.5 font-medium whitespace-nowrap",
              i === step ? "text-[#0A3855]" : "text-muted-foreground"
            )}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn("h-0.5 flex-1 mx-2 mt-[-14px] transition-colors duration-300", i < step ? "bg-green-400" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Steps ─────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Prénom</Label><Input value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Jean" /></div>
            <div className="space-y-2"><Label>Nom</Label><Input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Dupont" /></div>
          </div>
          <div className="space-y-2"><Label>Email professionnel</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jean@entreprise.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Mot de passe</Label>
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">{showPassword ? "Masquer" : "Afficher"}</button>
              </div>
              <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="6 caractères min." />
            </div>
            <div className="space-y-2"><Label>Confirmation</Label><Input type={showPassword ? "text" : "password"} value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} placeholder="Confirmez" /></div>
          </div>
          <div className="space-y-2"><Label>Société</Label><Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Ma Société SAS" /></div>
          <div className="space-y-2">
            <Label>Métier</Label>
            <select value={form.metier} onChange={(e) => set("metier", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {METIERS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-4">
          <div className="space-y-2"><Label>SIRET</Label><Input value={form.siret} onChange={(e) => set("siret", e.target.value)} placeholder="123 456 789 00012" /></div>
          <div className="space-y-2"><Label>N° TVA (optionnel)</Label><Input value={form.tva} onChange={(e) => set("tva", e.target.value)} placeholder="FR12345678901" /></div>
          <div className="space-y-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="12 rue des Lilas" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Ville</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Paris" /></div>
            <div className="space-y-2"><Label>Code postal</Label><Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} placeholder="75001" /></div>
          </div>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact (optionnel)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="contact@..." /></div>
            <div className="space-y-2"><Label>Téléphone</Label><Input type="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="06 12 34 56 78" /></div>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Extrait Kbis</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                form.kbisFile ? "border-green-400 bg-green-50" : "border-border hover:border-[#0A3855]/40"
              )}
              onClick={() => document.getElementById("kbis-upload")?.click()}
            >
              {form.kbisFile ? (
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm font-medium">{form.kbisFile.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <span className="text-sm">Glissez votre Kbis ici ou cliquez</span>
                  <span className="text-xs">PDF, JPG ou PNG</span>
                </div>
              )}
              <input id="kbis-upload" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => set("kbisFile", e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Code promo pour vos clients</Label>
            <div className="flex gap-2">
              <Input value={form.promoCode} onChange={(e) => set("promoCode", e.target.value)} placeholder="ex: DUPONT20" className="flex-1" />
              <Button type="button" variant="outline" onClick={autoCode}>Générer</Button>
            </div>
            {form.promoCode && (
              <p className="text-xs text-[#0A3855] bg-[#E5EDF1] rounded-lg px-3 py-2">
                Code <strong>{form.promoCode}</strong> — -20 € pour vos clients
              </p>
            )}
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <div className="bg-[#E5EDF1] rounded-xl p-5">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-[#0A3855] flex items-center justify-center text-lg shrink-0">👩</div>
              <div>
                <p className="font-semibold text-foreground mb-1">Coline Sinquin vous contacte</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Responsable partenariat, Coline vous contacte sous <strong>48h</strong> pour finaliser votre <strong>contrat d&apos;affiliation</strong> personnalisé.
                </p>
                <p className="text-xs text-muted-foreground mt-2">📧 coline@qlower.com</p>
              </div>
            </div>
          </div>
          <Alert>
            <AlertDescription>
              En attendant, vous pouvez finaliser votre RIB à l&apos;étape suivante.
            </AlertDescription>
          </Alert>
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <div className="space-y-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => set("iban", e.target.value)} placeholder="FR76 3000 6000..." /></div>
            <div className="space-y-2"><Label>BIC</Label><Input value={form.bic} onChange={(e) => set("bic", e.target.value)} placeholder="BNPAFRPP" /></div>
          </div>
          <div className="bg-[#E5EDF1] rounded-xl p-4 text-sm">
            <p className="font-semibold text-[#0A3855] mb-1">RIB Qlower</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              IBAN : FR76 1820 6004 5920 0400 0903 080<br />
              BIC : AGRIFRPP882 · Crédit Agricole
            </p>
          </div>
        </div>
      );
      case 5: return (
        <div className="space-y-4 text-center py-4">
          <div className="w-16 h-16 rounded-full bg-[#E5EDF1] flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#0A3855]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">Prêt à créer votre espace</p>
            <p className="text-sm text-muted-foreground mt-1">
              {form.company} · {form.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="secondary">Code : {form.promoCode}</Badge>
            <Badge variant="secondary">Affiliation</Badge>
            <Badge variant="secondary">{form.metier}</Badge>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-white to-[#E5EDF1]/30 px-4 py-12">
      <div className="w-full max-w-[520px]">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#0A3855]/80 flex items-center justify-center shadow-lg shadow-[#0A3855]/20 mb-3">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Devenir partenaire</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Créez votre espace en quelques étapes</p>
        </div>

        {renderProgress()}

        <Card className="shadow-lg shadow-black/[0.03] mb-4">
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form
              onSubmit={step === 5 ? handleFinish : (e) => { e.preventDefault(); next(); }}
              className="space-y-6"
            >
              {renderStep()}

              <div className="flex items-center justify-between pt-2">
                {step > 0 ? (
                  <Button type="button" variant="ghost" onClick={prev}>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Retour
                  </Button>
                ) : <div />}

                {step < 5 ? (
                  <Button type="submit">
                    Continuer
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Création en cours...
                      </span>
                    ) : "Créer mon compte"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Déjà partenaire ?{" "}
          <Link href="/login" className="text-[#0A3855] font-semibold hover:underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
