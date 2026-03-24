import { ReactNode } from "react";

type AlertType = "info" | "success" | "warning" | "error";

interface AlertProps {
  children: ReactNode;
  type?: AlertType;
  className?: string;
}

const styles: Record<AlertType, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-red-50 border-red-200 text-red-700",
};

export function Alert({ children, type = "info", className = "" }: AlertProps) {
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles[type]} ${className}`}>{children}</div>;
}
