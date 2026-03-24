"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, Button, Input, Alert, AlertDescription, Label } from "@/components/ui";

export default function SettingsTab() {
  const { supabase, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label>Mot de passe actuel</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mot de passe actuel"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700">
                {showCurrent ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 caracteres"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700">
                {showNew ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Confirmer le mot de passe</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le nouveau mot de passe"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700">
                {showConfirm ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

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
