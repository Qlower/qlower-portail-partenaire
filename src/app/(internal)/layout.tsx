import type { Metadata } from "next";
import { InternalShell } from "@/components/internal/InternalShell";

export const metadata: Metadata = {
  title: "Qlower — Sales",
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <InternalShell>{children}</InternalShell>;
}
