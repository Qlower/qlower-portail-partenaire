"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminPanel from "@/components/admin/AdminPanel";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.user_metadata?.role === "admin";

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace("/login");
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A3855]" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return <AdminPanel />;
}
