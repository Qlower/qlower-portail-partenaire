"use client";
import { InputHTMLAttributes, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>}
      <input
        ref={ref}
        className={`w-full px-3 py-2 rounded-lg border text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/30 focus:border-[#0A3855] transition ${error ? "border-red-300" : "border-gray-200"} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

// Password input with show/hide toggle
export function PasswordInput({ label, error, className = "", ...props }: InputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`w-full px-3 py-2 pr-16 rounded-lg border text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A3855]/30 focus:border-[#0A3855] transition ${error ? "border-red-300" : "border-gray-200"} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 select-none px-2 py-1"
        >
          {show ? "Masquer" : "Afficher"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
