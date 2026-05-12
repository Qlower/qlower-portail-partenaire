"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const role = meta?.role;
    const internalRole = meta?.internal_role;
    if (role === "admin") router.replace("/admin");
    else if (internalRole === "sales" || internalRole === "sales_admin") router.replace("/sales/ventes");
    else router.replace("/dashboard");
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-gray-400">Chargement...</p>
      </div>
    );
  }

  return <LoginForm />;
}
