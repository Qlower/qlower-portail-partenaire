"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { HomePage } from "@/components/HomePage";

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

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

  if (user) return null;

  return (
    <HomePage
      onLogin={() => router.push("/login")}
      onRegister={() => router.push("/register")}
    />
  );
}
