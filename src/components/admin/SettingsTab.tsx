"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, Button, PasswordInput, Alert } from "@/components/ui";

export default function SettingsTab() {
  const { supabase, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("Mot de passe mis a jour avec succes.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Erreur lors de la mise a jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <Card>
        <h4 className="font-semibold text-gray-900 mb-4">Changer le mot de passe</h4>

        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}
        {success && (
          <Alert type="success" className="mb-4">
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mot de passe actuel"
          />
          <PasswordInput
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 caracteres"
          />
          <PasswordInput
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer le nouveau mot de passe"
          />

          <Button type="submit" disabled={loading}>
            {loading ? "Mise a jour..." : "Mettre a jour le mot de passe"}
          </Button>
        </form>

        {user && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Connecte en tant que : {user.email}
            </p>
            <p className="text-xs text-gray-400">
              Role : {user.user_metadata?.role || "N/A"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
