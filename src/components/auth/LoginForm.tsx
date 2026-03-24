"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isValidEmail } from "@/services/links";
import { Button, Input, PasswordInput, Alert } from "@/components/ui";

export default function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur de connexion.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#1a5a7a] flex items-center justify-center shadow-lg mb-4">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Qlower Pro</h1>
          <p className="text-sm text-gray-500 mt-1">
            Portail Partenaire
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
            Connexion
          </h2>

          {error && (
            <Alert type="error" className="mb-5">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="vous@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <PasswordInput
              label="Mot de passe"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{" "}
              <a
                href="/register"
                className="text-[#0A3855] font-semibold hover:underline"
              >
                Devenir partenaire
              </a>
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          &copy; {new Date().getFullYear()} Qlower. Tous droits
          r&eacute;serv&eacute;s.
        </p>
      </div>
    </div>
  );
}
