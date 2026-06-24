/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les réponses. Volontairement sans
// CSP stricte (script-src) pour ne pas casser Next/Stripe/HubSpot/Supabase —
// on se limite à frame-ancestors (anti-clickjacking) + les en-têtes standards.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig = {
  serverExternalPackages: ["pdfkit"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
