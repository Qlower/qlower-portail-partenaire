"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

function SetupPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [validation, setValidation] = useState<"loading" | "valid" | "invalid">("loading");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Validate token on mount (read-only, does NOT consume)
  useEffect(() => {
    if (!token) {
      setValidation("invalid");
      setReason("Lien invalide");
      return;
    }
    fetch(`/api/auth/setup-password?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setValidation("valid");
          setEmail(d.email);
        } else {
          setValidation("invalid");
          setReason(
            d.reason === "already_used"
              ? "Ce lien a déjà été utilisé."
              : d.reason === "expired"
              ? "Ce lien a expiré (validité 7 jours)."
              : "Lien invalide ou introuvable."
          );
        }
      })
      .catch(() => {
        setValidation("invalid");
        setReason("Erreur de vérification");
      });
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Mot de passe trop court (8 caractères minimum).");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setDone(true);
      setTimeout(() => router.push("/login?msg=password-set"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (validation === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#0A3855]" />
      </div>
    );
  }

  if (validation === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFF5ED]/20 to-[#E5EDF1]/40 px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Lien invalide</CardTitle>
            <CardDescription>{reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 text-center mb-4">
              Vous pouvez demander un nouveau lien depuis la page de connexion.
            </p>
            <Button onClick={() => router.push("/login")} className="w-full">
              Aller à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFF5ED]/20 to-[#E5EDF1]/40 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-gray-900">Mot de passe défini ✓</p>
            <p className="text-sm text-gray-500">Redirection vers la connexion...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFF5ED]/20 to-[#E5EDF1]/40 px-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#0A3855] flex items-center justify-center shadow-lg shadow-[#0A3855]/15 mb-3">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Activer mon espace</h1>
          <p className="text-sm text-gray-400 mt-0.5">Définissez votre mot de passe</p>
        </div>

        <Card className="shadow-xl shadow-black/[0.04] border-0">
          <CardHeader className="text-center pb-1">
            <CardTitle className="text-base">Mot de passe</CardTitle>
            <CardDescription>
              Pour <span className="font-semibold text-[#0A3855]">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="8 caractères minimum"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="Retapez votre mot de passe"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" size="lg" disabled={submitting} className="w-full">
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Définir mon mot de passe"
                )}
              </Button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-4">
              Une fois défini, vous pourrez vous connecter à tout moment avec votre email + ce mot de passe.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin text-[#0A3855]" /></div>}>
      <SetupPasswordContent />
    </Suspense>
  );
}
