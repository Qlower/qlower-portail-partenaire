# Portail Partenaire Qlower

## Projet
Application Next.js 16 (App Router) pour le programme partenaires Qlower. Permet aux partenaires (CGP, agences, courtiers...) de suivre leurs leads, commissions et referrals. Inclut un panel admin pour l'équipe Qlower.

## Stack
- **Framework** : Next.js 16 (App Router, TypeScript strict)
- **UI** : Tailwind CSS v4 + shadcn/ui (Radix) + Lucide icons
- **Data** : React Query (@tanstack/react-query) + Axios
- **Auth** : Supabase Auth (email/password, cookies via middleware)
- **BDD** : Supabase PostgreSQL + Row Level Security
- **API externe** : HubSpot (contacts, workflows, webhooks)
- **Deploy** : Vercel (auto-deploy GitHub)

## Architecture

```
src/
├── app/                       # Routes Next.js
│   ├── page.tsx               # Landing (/)
│   ├── login/                 # Connexion
│   ├── register/              # Inscription multi-étapes
│   ├── dashboard/             # Espace partenaire (auth required)
│   │   ├── layout.tsx         # Shell: TopBar + Sidebar + PartnerContext
│   │   ├── page.tsx           # Dashboard
│   │   ├── referer/           # Référer un client
│   │   ├── revenus/           # Revenus & facturation
│   │   ├── outils/            # Boîte à outils
│   │   ├── settings/          # Paramètres
│   │   └── guide/             # Onboarding guide
│   ├── admin/                 # Panel admin (role=admin)
│   ├── auth/callback/         # Callback Supabase
│   └── api/                   # API Routes (server-side)
│       ├── admin/             # CRUD partenaires (service_role)
│       ├── hubspot/           # Proxy HubSpot
│       ├── webhooks/hubspot/  # Webhook entrant HubSpot
│       └── export/            # Export xlsx + factures
├── components/
│   ├── ui/                    # shadcn/ui (NE PAS MODIFIER À LA MAIN - utiliser `npx shadcn add`)
│   ├── auth/                  # LoginForm, RegisterForm
│   ├── dashboard/             # Dashboard, BarChart, OnboardingGuide
│   ├── partner/               # PageReferer, ReferralForm, Revenus, Outils, Parametres
│   ├── admin/                 # AdminPanel, PartnersTab, CommissionEditor, etc.
│   ├── layout/                # TopBar, Sidebar
│   ├── HomePage.tsx           # Landing page
│   └── Providers.tsx          # QueryClient + AuthProvider
├── hooks/
│   ├── useAuth.ts             # Auth context + hook
│   ├── usePartnerData.ts      # React Query: usePartner, useLeads, useReferrals...
│   ├── useMutations.ts        # React Query: addReferral, onboardPartner...
│   └── useAdminData.ts        # React Query: useAdminPartners, useCreatePartner...
├── services/                  # Logique métier pure (pas de React)
│   ├── commission.ts          # calcCommission, COMM_LABELS, DEFAULT_TRANCHES
│   ├── links.ts               # buildSignupLink, buildRdvLink, slug, isValidEmail
│   └── constants.ts           # BENCHMARK, METIERS, PARTNER_TYPES, STAGE_STYLES
├── types/index.ts             # Types TS: Partner, Lead, Referral, Invoice...
├── lib/
│   ├── supabase-browser.ts    # Client navigateur (anon key, respecte RLS)
│   ├── supabase-server.ts     # Client serveur (service_role, bypass RLS)
│   ├── axios.ts               # Instance Axios (baseURL: "/api")
│   └── utils.ts               # cn() helper
└── middleware.ts               # Refresh session Supabase
```

## Conventions

### Composants
- `"use client"` sur tout composant interactif
- Imports shadcn individuels: `import { Button } from "@/components/ui/Button"`
- Icônes: `lucide-react` uniquement (pas d'emojis)
- Tailwind CSS uniquement (pas d'inline styles)
- Props typées: `interface ComponentNameProps { ... }`
- Fonctions de rendu inline = fonctions (`renderStep()`) et non composants (`<StepContent/>`) pour éviter les remontages

### Data fetching
- **TOUJOURS React Query** pour le data fetching (pas de useEffect + useState + fetch)
- Hooks dans `hooks/usePartnerData.ts` (partner) et `hooks/useAdminData.ts` (admin)
- Query keys normalisées: `["partner", id]`, `["leads", partnerId]`, `["admin", "partners"]`
- Mutations avec `invalidateQueries` dans `onSuccess`
- `enabled: !!id` pour éviter les requêtes sans ID

### API Routes
- Token HubSpot: JAMAIS côté client
- API routes admin: `createServiceClient()` (service_role, bypass RLS)
- Client navigateur: `createClient()` (anon key, respecte RLS)
- Typer `request` avec `NextRequest`

### Auth
- Admin: `user_metadata.role === "admin"` → redirige vers `/admin`
- Partenaire: `user_metadata.partner_id` → lookup dans table `partners`
- Fallback: lookup par `user_id` si partner_id manquant dans metadata
- Login redirige admin vers `/admin`, partenaire vers `/dashboard`

## Couleurs Qlower
```
Primary:    #0A3855  (navy)     → CSS var --primary
Primary bg: #E5EDF1              → bg-[#E5EDF1]
Accent:     #F6CCA4  (sable)    → bg-[#F6CCA4]
Accent bg:  #FFF5ED              → bg-[#FFF5ED]
```

## BDD Supabase
| Table | RLS | Description |
|-------|-----|-------------|
| partners | select/update own | Partenaires |
| leads | select/insert own | Leads UTM et manuels |
| stats_monthly | select own | Stats mensuelles |
| partner_actions | select/insert own | Log d'actions |
| referrals | select/insert own | Referrals manuels |
| invoices | select own | Factures |

## HubSpot Webhook
```
POST /api/webhooks/hubspot
  → Reçoit contact.creation + contact.propertyChange
  → Fetch contact HubSpot → trouve partenaire par UTM
  → Upsert lead dans Supabase + update stage
```

### Mapping lifecycle
| HubSpot | Stage |
|---------|-------|
| lead, MQL, SQL, opportunity, non payeur, churn | Non payeur |
| customer, evangelist | Payeur |
| 999998694 (User abonné) | Abonné |

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HUBSPOT_TOKEN=
HUBSPOT_CLIENT_SECRET=
```

## Comptes
- **Admin**: admin@qlower.com / admin2026 → /admin
- **Test partenaire**: tristan@qlower.com → /dashboard

## Commandes
```bash
npm run dev                        # Dev (localhost:3000)
npx next build                     # Build prod
npx shadcn@latest add <component>  # Ajouter composant shadcn
```
