"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PartnerShell } from "@/components/layout/PartnerShell";
import { HomePage } from "@/components/HomePage";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";

type View = "home" | "login" | "register" | "app";

export default function Page() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>("home");

  useEffect(() => {
    if (user && view !== "register") {
      setView("app");
    }
  }, [user, view]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0A3855] flex items-center justify-center text-white font-bold text-lg animate-pulse">
            Q
          </div>
          <p className="text-sm text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (user && view === "app") {
    return <PartnerShell />;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      {view === "home" && (
        <HomePage
          onLogin={() => setView("login")}
          onRegister={() => setView("register")}
        />
      )}
      {view === "login" && <LoginForm />}
      {view === "register" && <RegisterForm />}
    </main>
  );
}
