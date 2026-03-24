"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardPartner } from "@/hooks/useMutations";
import { isValidEmail } from "@/services/links";
import { METIERS } from "@/services/constants";
import { Button, Input, PasswordInput, Select, Alert, Card } from "@/components/ui";

const STEP_LABELS = [
  "Compte",
  "Informations",
  "Documents",
  "Contrat",
  "RIB",
  "Synchronisation",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

interface FormData {
  prenom: string;
  nom: string;
  email: string;
  password: string;
  passwordConfirm: string;
  company: string;
  metier: string;
  siret: string;
  tva: string;
  address: string;
  city: string;
  postalCode: string;
  contactEmail: string;
  contactPhone: string;
  kbisFile: File | null;
  promoCode: string;
  iban: string;
  bic: string;
}

const initial: FormData = {
  prenom: "",
  nom: "",
  email: "",
  password: "",
  passwordConfirm: "",
  company: "",
  metier: METIERS[0],
  siret: "",
  tva: "",
  address: "",
  city: "",
  postalCode: "",
  contactEmail: "",
  contactPhone: "",
  kbisFile: null,
  promoCode: "",
  iban: "",
  bic: "",
};

export default function RegisterForm() {
  const { signUp } = useAuth();
  const onboard = useOnboardPartner();

  const [step, setStep] = useState<StepIndex>(0);
  const [form, setForm] = useState<FormData>(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.prenom || !form.nom) return "Prenom et nom requis.";
      if (!isValidEmail(form.email)) return "Email invalide.";
      if (form.password.length < 6) return "Mot de passe : 6 caracteres minimum.";
      if (form.password !== form.passwordConfirm) return "Les mots de passe ne correspondent pas.";
      if (!form.company) return "Nom de societe requis.";
    }
    if (step === 1) {
      if (!form.siret) return "SIRET requis.";
      if (!form.address || !form.city || !form.postalCode) return "Adresse complete requise.";
    }
    if (step === 4) {
      if (!form.iban) return "IBAN requis.";
      if (!form.bic) return "BIC requis.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, 5) as StepIndex);
  };

  const prev = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0) as StepIndex);
  };

  const handleFinish = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Sync to HubSpot
      await onboard.mutateAsync({
        partnerName: form.company,
        utmValue: form.company.toLowerCase().replace(/\s+/g, "-"),
      });

      // 2. Create Supabase account
      await signUp(form.email, form.password, {
        first_name: form.prenom,
        last_name: form.nom,
        company: form.company,
        metier: form.metier,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la creation du compte.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Step progress indicator ────────────────────────────────── */
  const Progress = () => (
    <div className="flex items-center justify-center mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                    ? "bg-[#0A3855] text-white ring-4 ring-[#0A3855]/20"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < step ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                i === step ? "text-[#0A3855]" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 mt-[-14px] transition-colors duration-300 ${
                i < step ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  /* ── Step content ───────────────────────────────────────────── */
  const StepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Prenom" value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Jean" />
              <Input label="Nom" value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Dupont" />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jean@entreprise.com" />
            <PasswordInput label="Mot de passe" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="6 caracteres minimum" />
            <PasswordInput label="Confirmer le mot de passe" value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} placeholder="Confirmez votre mot de passe" />
            <Input label="Societe" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Ma Societe SAS" />
            <Select
              label="Metier"
              options={METIERS.map((m) => m)}
              value={form.metier}
              onChange={(e) => set("metier", e.target.value)}
            />
          </div>
        );

      case 1:
        return (
          <div className="flex flex-col gap-4">
            <Input label="SIRET" value={form.siret} onChange={(e) => set("siret", e.target.value)} placeholder="123 456 789 00012" />
            <Input label="Numero de TVA (optionnel)" value={form.tva} onChange={(e) => set("tva", e.target.value)} placeholder="FR12345678901" />
            <Input label="Adresse" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="12 rue des Lilas" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ville" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Paris" />
              <Input label="Code postal" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} placeholder="75001" />
            </div>
            <Input label="Email de contact (optionnel)" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="contact@entreprise.com" />
            <Input label="Telephone de contact (optionnel)" type="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="06 12 34 56 78" />
          </div>
        );

      case 2:
        return (
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                Extrait Kbis
              </label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#0A3855]/40 transition-colors cursor-pointer"
                onClick={() => document.getElementById("kbis-upload")?.click()}
              >
                {form.kbisFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">{form.kbisFile.name}</span>
                    <span className="text-xs text-gray-400">Cliquez pour changer</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-500">
                      Cliquez pour deposer votre Kbis
                    </span>
                    <span className="text-xs text-gray-400">PDF, JPG ou PNG</span>
                  </div>
                )}
                <input
                  id="kbis-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => set("kbisFile", e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <Input
              label="Code promo (optionnel)"
              value={form.promoCode}
              onChange={(e) => set("promoCode", e.target.value)}
              placeholder="PARTNER2024"
            />
          </div>
        );

      case 3:
        return (
          <div className="flex flex-col gap-5">
            <div className="bg-gradient-to-br from-[#0A3855]/5 to-[#1a5a7a]/5 border border-[#0A3855]/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Votre interlocutrice
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#0A3855]/10 flex items-center justify-center">
                  <span className="text-[#0A3855] text-lg font-bold">C</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Coline</p>
                  <p className="text-xs text-gray-500">Responsable Partenariats</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  coline@qlower.com
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  01 86 26 64 00
                </div>
              </div>
            </div>
            <Alert type="info">
              Le contrat de partenariat vous sera envoy&eacute; par email apr&egrave;s validation de votre dossier par notre &eacute;quipe.
            </Alert>
          </div>
        );

      case 4:
        return (
          <div className="flex flex-col gap-4">
            <Alert type="info">
              Ces informations serviront au versement de vos commissions.
            </Alert>
            <Input label="IBAN" value={form.iban} onChange={(e) => set("iban", e.target.value)} placeholder="FR76 1234 5678 9012 3456 7890 123" />
            <Input label="BIC" value={form.bic} onChange={(e) => set("bic", e.target.value)} placeholder="BNPAFRPP" />
          </div>
        );

      case 5:
        return (
          <div className="flex flex-col gap-5">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Tout est pr&ecirc;t !
              </h3>
              <p className="text-sm text-gray-500">
                Synchronisation HubSpot et cr&eacute;ation de votre espace partenaire.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Societe</span>
                <span className="font-medium text-gray-900">{form.company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{form.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Metier</span>
                <span className="font-medium text-gray-900">{form.metier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">SIRET</span>
                <span className="font-medium text-gray-900">{form.siret}</span>
              </div>
            </div>

            {onboard.isSuccess && (
              <Alert type="success">HubSpot synchronis&eacute; avec succ&egrave;s.</Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#1a5a7a] flex items-center justify-center shadow-lg mb-3">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Devenir partenaire</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cr&eacute;ez votre espace en quelques &eacute;tapes
          </p>
        </div>

        <Progress />

        <Card className="mb-4">
          {error && (
            <Alert type="error" className="mb-5">
              {error}
            </Alert>
          )}

          <form
            onSubmit={step === 5 ? handleFinish : (e) => { e.preventDefault(); next(); }}
            className="flex flex-col gap-6"
          >
            <StepContent />

            <div className="flex items-center justify-between pt-2">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={prev}>
                  Retour
                </Button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <Button type="submit">Continuer</Button>
              ) : (
                <Button type="submit" disabled={loading} variant="success">
                  {loading ? "Creation en cours..." : "Creer mon compte"}
                </Button>
              )}
            </div>
          </form>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            D&eacute;j&agrave; partenaire ?{" "}
            <a href="/login" className="text-[#0A3855] font-semibold hover:underline">
              Se connecter
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
