interface PageHeaderProps {
  title: string;
  subtitle?: string;
  gradient?: string;
}

export function PageHeader({ title, subtitle, gradient }: PageHeaderProps) {
  const bg = gradient || "from-[#0A3855] to-[#1a5a7a]";
  return (
    <div className={`bg-gradient-to-br ${bg} rounded-xl px-6 py-4 mb-5`}>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-white/80 mt-1">{subtitle}</p>}
    </div>
  );
}
