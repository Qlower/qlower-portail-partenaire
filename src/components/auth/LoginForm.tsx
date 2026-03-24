"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isValidEmail } from "@/services/links";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

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
    if (!isValidEmail(email)) { setError("Adresse email invalide."); return; }
    if (!password) { setError("Veuillez saisir votre mot de passe."); return; }

    setLoading(true);
    try {
      const { session } = await signIn(email, password);
      const role = session?.user?.user_metadata?.role;
      router.push(role === "admin" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de connexion.";
      setError(message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFF5ED]/20 to-[#E5EDF1]/40 px-4">
      <div className="w-full max-w-[420px]">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Retour
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0A3855] flex items-center justify-center shadow-lg shadow-[#0A3855]/15 mb-4">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Qlower Pro</h1>
          <p className="text-sm text-gray-400 mt-0.5">Portail Partenaire</p>
        </div>

        {/* Card */}
        <Card className="shadow-xl shadow-black/[0.04] border-0">
          <CardHeader className="text-center pb-1">
            <CardTitle className="text-lg">Connexion</CardTitle>
            <CardDescription>Accédez à votre espace partenaire</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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

              <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Se connecter
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <Separator />

          <CardFooter className="justify-center py-4">
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-[#0A3855] font-semibold hover:underline underline-offset-4">
                Devenir partenaire
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-xs text-gray-400 text-center mt-6">
          &copy; {new Date().getFullYear()} Qlower. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
