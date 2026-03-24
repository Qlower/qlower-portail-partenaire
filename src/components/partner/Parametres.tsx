"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button, PasswordInput, Alert, Card, PageHeader } from "@/components/ui";
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

  return (
    <div>
      <PageHeader
        title="Parametres"
        subtitle="Gerez votre compte et vos preferences"
      />

      {/* Account info */}
      <Card className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Informations du compte
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{user?.email ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Societe</span>
            <span className="text-sm font-medium text-gray-900">{partner.nom}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Type de contrat</span>
            <span className="text-sm font-medium text-gray-900 capitalize">
              {partner.contrat.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Code partenaire</span>
            <span className="text-sm font-medium text-[#0A3855] font-mono">{partner.code}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Membre depuis</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(partner.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </Card>

      {/* Password change */}
      <Card className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Changer le mot de passe
        </h3>

        {pwdSuccess && (
          <Alert type="success" className="mb-4">
            Mot de passe modifi&eacute; avec succ&egrave;s.
          </Alert>
        )}

        {pwdError && (
          <Alert type="error" className="mb-4">
            {pwdError}
          </Alert>
        )}

        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <PasswordInput
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6 caracteres minimum"
          />
          <PasswordInput
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmez le nouveau mot de passe"
          />
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Modification..." : "Mettre a jour"}
          </Button>
        </form>
      </Card>

      {/* Restart guide */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Guide de demarrage
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Relancez le guide de pr&eacute;sentation pour red&eacute;couvrir les fonctionnalit&eacute;s du portail.
        </p>
        <Button variant="outline" onClick={onRestartGuide}>
          Relancer le guide
        </Button>
      </Card>
    </div>
  );
}
