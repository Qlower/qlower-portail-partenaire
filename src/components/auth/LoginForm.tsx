"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isValidEmail } from "@/services/links";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(email)) {
      setError("Adresse email invalide.");
      return;
    }
    if (!password) {
      setError("Veuillez saisir votre mot de passe.");
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de connexion.";
      setError(
        message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-white to-[#E5EDF1]/30 px-4">
      <div className="w-full max-w-[420px]">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#0A3855]/80 flex items-center justify-center shadow-lg shadow-[#0A3855]/20 mb-4">
            <span className="text-white text-2xl font-black tracking-tight">Q</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Qlower Pro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Portail Partenaire</p>
        </div>

        {/* Card */}
        <Card className="shadow-lg shadow-black/[0.03]">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Connexion</CardTitle>
            <CardDescription>
              Entrez vos identifiants pour accéder à votre espace
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full mt-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connexion...
                  </span>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>

          <Separator />

          <CardFooter className="justify-center py-4">
            <p className="text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-[#0A3855] font-semibold hover:underline underline-offset-4">
                Devenir partenaire
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          &copy; {new Date().getFullYear()} Qlower. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
