"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Shield,
  Database,
  PlayCircle,
} from "lucide-react";

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
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4 text-[#0A3855]" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>
            Mettez a jour votre mot de passe pour securiser votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4">
              <CheckCircle2 className="size-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mot de passe actuel"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showCurrent ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showNew ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le nouveau mot de passe"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Mise a jour...
                </>
              ) : (
                <>
                  <Lock className="size-4 mr-1.5" />
                  Mettre a jour le mot de passe
                </>
              )}
            </Button>
          </form>

          {user && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  <User className="size-3.5" />
                  Connecte en tant que : {user.email}
                </p>
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  <Shield className="size-3.5" />
                  Role : {user.user_metadata?.role || "N/A"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MigrationCard />
    </div>
  );
}

// ============================================================================
// Carte "Migrations Postgres" — bouton one-shot pour exécuter les ALTER TABLE
// nécessaires aux nouvelles features (champs juridiques pour la génération
// automatique de contrat, etc.).
// ============================================================================
function MigrationCard() {
  const [status, setStatus] = useState<{ existing: string[]; missing: string[] } | null>(null);
  const [running, setRunning] = useState<"check" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const check = async () => {
    setRunning("check");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/migrate-legal-fields");
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Erreur");
      setStatus({ existing: j.existing || [], missing: j.missing || [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRunning(null);
    }
  };

  const apply = async () => {
    setRunning("apply");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/migrate-legal-fields", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Erreur");
      const added = (j.added as string[]) || [];
      setSuccess(
        added.length === 0
          ? "Tous les champs étaient déjà présents — migration no-op."
          : `Migration appliquée : ${added.length} colonne(s) ajoutée(s) → ${added.join(", ")}.`,
      );
      setStatus({ existing: j.existingAfter || [], missing: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRunning(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="size-4 text-[#0A3855]" />
          Migrations Postgres
        </CardTitle>
        <CardDescription className="text-xs">
          Applique les changements de schéma à la table <code>partners</code> requis pour la
          génération automatique de contrat (forme juridique, capital, RCS, civilité, fonction).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={check}
            disabled={!!running}
          >
            {running === "check" ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Vérification…
              </>
            ) : (
              <>
                <Eye className="size-3.5 mr-1.5" /> Vérifier l&apos;état
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={apply}
            disabled={!!running}
            className="bg-[#0A3855] hover:bg-[#0A3855]/90"
          >
            {running === "apply" ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Application…
              </>
            ) : (
              <>
                <PlayCircle className="size-3.5 mr-1.5" /> Appliquer la migration
              </>
            )}
          </Button>
        </div>

        {status && (
          <div className="text-xs space-y-1.5 bg-gray-50 rounded p-3 border border-gray-100">
            <div>
              <span className="font-semibold text-gray-700">Présents :</span>{" "}
              {status.existing.length === 0 ? (
                <span className="text-gray-400 italic">aucun</span>
              ) : (
                <span className="text-emerald-700">{status.existing.join(", ")}</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-gray-700">Manquants :</span>{" "}
              {status.missing.length === 0 ? (
                <span className="text-emerald-700">aucun ✅</span>
              ) : (
                <span className="text-amber-700">{status.missing.join(", ")}</span>
              )}
            </div>
          </div>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertDescription className="text-xs text-emerald-700">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">
              {error}
              {/POSTGRES_URL|DATABASE_URL/.test(error) && (
                <div className="mt-2 text-[11px] leading-relaxed">
                  Aucune chaîne de connexion Postgres n&apos;est configurée sur Vercel. Deux options :
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    <li>Active l&apos;intégration <strong>Vercel ↔ Supabase</strong> (configure auto <code>POSTGRES_URL_NON_POOLING</code>).</li>
                    <li>Ou ajoute manuellement <code>DATABASE_URL</code> dans Vercel → Settings → Environment Variables, valeur récupérée dans Supabase Dashboard → Project Settings → Database → Connection string (mode <em>Session</em>).</li>
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
