"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Partner } from "@/types";

interface ParametresProps {
  partner: Partner;
  onRestartGuide?: () => void;
}

export default function Parametres({ partner, onRestartGuide }: ParametresProps) {
  const { user, supabase } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess(false);

    if (newPassword.length < 6) {
      setPwdError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwdSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du changement de mot de passe.";
      setPwdError(message);
    } finally {
      setLoading(false);
    }
  };

  const accountRows = [
    { label: "Email", value: partner.email || user?.email || "-" },
    { label: "Societe", value: partner.nom },
    { label: "Type de contrat", value: partner.contrat.replace("_", " "), capitalize: true },
    { label: "Code partenaire", value: partner.code || "En attente", mono: !!partner.code },
    {
      label: "Date de signature du contrat",
      value: partner.contract_signed_at
        ? new Date(partner.contract_signed_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "Non renseignée",
    },
    {
      label: "Membre depuis",
      value: new Date(partner.created_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parametres"
        subtitle="Gerez votre compte et vos preferences"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account info */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E5EDF1] flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-[#0A3855]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900">Informations du compte</CardTitle>
                <CardDescription className="text-xs text-gray-500">Vos informations partenaire</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {accountRows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span
                    className={`text-sm font-medium ${
                      row.mono
                        ? "text-[#0A3855] font-mono bg-[#E5EDF1]/50 px-2 py-0.5 rounded"
                        : "text-gray-900"
                    } ${row.capitalize ? "capitalize" : ""}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Password change */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E5EDF1] flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-[#0A3855]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900">Changer le mot de passe</CardTitle>
                <CardDescription className="text-xs text-gray-500">Mettez &agrave; jour votre mot de passe</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pwdSuccess && (
              <Alert className="mb-5 border-green-200 bg-green-50">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <AlertDescription className="text-green-700">Mot de passe modifi&eacute; avec succ&egrave;s.</AlertDescription>
              </Alert>
            )}

            {pwdError && (
              <Alert variant="destructive" className="mb-5 border-red-200 bg-red-50">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <AlertDescription className="text-red-700">{pwdError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    type={showNewPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 caracteres minimum"
                    className="border-gray-200 focus:border-[#0A3855] focus:ring-[#0A3855]/20 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#0A3855]/60 hover:text-[#0A3855] transition-colors"
                  >
                    {showNewPwd ? "Masquer" : "Afficher"}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPwd ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez le nouveau mot de passe"
                    className="border-gray-200 focus:border-[#0A3855] focus:ring-[#0A3855]/20 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#0A3855]/60 hover:text-[#0A3855] transition-colors"
                  >
                    {showConfirmPwd ? "Masquer" : "Afficher"}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A3855] hover:bg-[#0A3855]/90 text-white shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Modification...
                  </span>
                ) : (
                  "Mettre a jour"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Restart guide */}
      <Card className="border-gray-200 shadow-sm bg-gradient-to-r from-[#FFF5ED]/50 to-white">
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FFF5ED] border border-[#F6CCA4]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#F6CCA4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Guide de demarrage</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Relancez le guide de pr&eacute;sentation pour red&eacute;couvrir les fonctionnalit&eacute;s du portail.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onRestartGuide}
            className="border-[#0A3855]/20 text-[#0A3855] hover:bg-[#E5EDF1]/50 whitespace-nowrap"
          >
            Relancer le guide
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
