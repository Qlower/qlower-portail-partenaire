// POST /api/admin/provision-master?token=...
// Body: { network_id, email, password }
//
// Crée un compte "master" (siège réseau) : utilisateur Supabase + ligne
// network_members. Token-guardé (provisioning ponctuel). Multi-utilisateur :
// on peut appeler plusieurs fois pour ajouter plusieurs masters au même réseau.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const networkId = body.network_id as string | undefined;
  const email = body.email as string | undefined;
  const password = body.password as string | undefined;
  if (!networkId || !email || !password) {
    return NextResponse.json({ error: "network_id, email, password requis" }, { status: 400 });
  }

  const sb = createServiceClient();

  const { data: net } = await sb.from("networks").select("id").eq("id", networkId).maybeSingle();
  if (!net) return NextResponse.json({ error: `réseau ${networkId} introuvable` }, { status: 404 });

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "master", network_id: networkId },
  });
  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || "création user échouée" }, { status: 500 });
  }
  const userId = created.user.id;

  const { error: memErr } = await sb
    .from("network_members")
    .insert({ network_id: networkId, user_id: userId, role: "master" });
  if (memErr) {
    return NextResponse.json({ error: memErr.message, userId }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, email, network_id: networkId });
}
