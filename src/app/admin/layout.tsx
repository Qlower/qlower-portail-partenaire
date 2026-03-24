"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200/80 px-6 py-3 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0A3855] flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="text-base font-semibold text-[#0A3855] tracking-tight">
            Administration Qlower
          </span>
          <Badge className="bg-[#FFF5ED] text-[#B8864E] border border-[#F6CCA4]/50 hover:bg-[#FFF5ED]">
            <Shield className="size-3 mr-0.5" />
            Master Pro
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="text-gray-500 hover:text-gray-900"
        >
          <LogOut className="size-4 mr-1.5" />
          Deconnexion
        </Button>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
