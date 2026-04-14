"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function MagicPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // 1. Handle PKCE flow: code in query params
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (!err) router.replace("/dashboard");
        else setError(true);
      });
      return;
    }

    // 2. Handle implicit flow: tokens in hash fragment
    //    (Supabase PKCE client ignores hash tokens, so we parse them manually)
    const hash = window.location.hash.substring(1);
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error: err }) => {
          if (!err) router.replace("/dashboard");
          else setError(true);
        });
        return;
      }
    }

    // 3. Fallback: session may already be set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        setTimeout(() => setError(true), 5000);
      }
    });
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-gray-700 font-medium mb-1">Lien invalide ou expiré</p>
          <p className="text-sm text-gray-400">Demandez un nouveau lien depuis l&apos;admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">Connexion en cours…</p>
    </div>
  );
}
