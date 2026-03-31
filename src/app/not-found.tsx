import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A3855] to-[#1a5a7a] flex items-center justify-center shadow-lg mx-auto mb-6">
          <span className="text-white text-3xl font-black">Q</span>
        </div>
        <h1 className="text-6xl font-extrabold text-[#0A3855] mb-2">404</h1>
        <p className="text-lg font-semibold text-gray-900 mb-2">Page introuvable</p>
        <p className="text-sm text-gray-500 mb-8">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-[#0A3855] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#0A3855]/90 transition-colors"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
