"use client";
import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
}

export function CopyButton({ text, label = "Copier", onCopied, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${copied ? "bg-green-600" : "bg-[#0A3855] hover:bg-[#1a5a7a]"} ${className}`}
    >
      {copied ? "Copie !" : label}
    </button>
  );
}
