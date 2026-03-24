"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "accent" | "success" | "danger" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = "primary", children, className = "", disabled, ...props }: ButtonProps) {
  const base = "px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary: "bg-[#0A3855] text-white hover:bg-[#0A3855]/90 shadow-sm",
    secondary: "bg-[#E5EDF1] text-[#0A3855] hover:bg-[#E5EDF1]/80",
    accent: "bg-[#F6CCA4] text-[#1C1C1C] hover:bg-[#F5C89A] shadow-sm",
    success: "bg-green-600 text-white hover:bg-green-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border-2 border-[#0A3855] text-[#0A3855] hover:bg-blue-50",
    ghost: "text-gray-500 hover:bg-gray-100",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled} {...props}>{children}</button>;
}
