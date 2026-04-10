"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { isValidEmail } from "@/services/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) { setError("Adresse email invalide."); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFF5ED]/20 to-[#E5EDF1]/40 px-4">
      <div className="w-full max-w-[420px]">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Retour à la connexion
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0A3855] flex items-center justify-center shadow-lg shadow-[#0A3855]/15 mb-4">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="text-sm text-gray-400 mt-0.5">Réinitialisez votre mot de passe</p>
        </div>

        <Card className="shadow-xl shadow-black/[0.04] border-0">
          <CardHeader className="text-center pb-1">
            <CardTitle className="text-lg">
              {sent ? "Email envoyé" : "Réinitialisation"}
            </CardTitle>
            <CardDescription>
              {sent
                ? "Vérifiez votre boîte mail (et vos spams)"
                : "Saisissez votre email pour recevoir un lien de réinitialisation"
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {sent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Un email a été envoyé à <strong>{email}</strong>
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Cliquez sur le lien dans l&apos;email pour définir un nouveau mot de passe.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            ) : (
              <>
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

                  <Button type="submit" size="lg" disabled={loading} className="w-full">
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Envoyer le lien de réinitialisation"
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
