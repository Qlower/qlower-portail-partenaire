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
        if (!err) {
          router.replace("/dashboard");
        } else {
          console.error("Code exchange failed:", err.message);
          setError(true);
        }
      });
      return;
    }

    // 2. Handle implicit flow: tokens in hash fragment
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          router.replace("/dashboard");
        }
      }
    );

    // 3. Fallback: session may already be set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        setTimeout(() => setError(true), 5000);
      }
    });

    return () => subscription.unsubscribe();
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
