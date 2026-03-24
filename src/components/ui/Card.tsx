import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export function Card({ children, className = "", padding = "md" }: CardProps) {
  const pad = { sm: "p-3", md: "p-5", lg: "p-6" };
  return <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${pad[padding]} ${className}`}>{children}</div>;
}
