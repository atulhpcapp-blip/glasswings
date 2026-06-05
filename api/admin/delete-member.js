// Glasswings — permanently delete a member (superadmin only).
// Removes their data across tables, then deletes the auth account.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const body = (typeof req.body === "object" && req.body) ? req.body : await readBody(req);
  const { access_token, user_id } = body;
  if (!access_token || !user_id) return res.status(400).json({ error: "Missing details." });

  try {
    const { data: ures } = await sb.auth.getUser(access_token);
    const callerId = ures?.user?.id;
    if (!callerId) return res.status(401).json({ error: "Please log in again." });

    const { data: caller } = await sb.from("profiles").select("roles, role").eq("id", callerId).single();
    const isSuper = (caller?.roles || []).includes("superadmin") || caller?.role === "superadmin";
    if (!isSuper) return res.status(403).json({ error: "Only the superadmin can delete members." });
    if (user_id === callerId) return res.status(400).json({ error: "You can't delete your own account here." });

    const { data: target } = await sb.from("profiles").select("roles").eq("id", user_id).single();
    if ((target?.roles || []).includes("superadmin")) return res.status(400).json({ error: "The superadmin cannot be deleted." });

    // remove the member's rows everywhere (ignore tables that don't apply)
    const wipe = async (table, col) => { try { await sb.from(table).delete().eq(col, user_id); } catch {} };
    await wipe("messages", "sender_id");
    await wipe("event_tickets", "user_id");
    await wipe("event_attendance", "user_id");
    await wipe("room_subscriptions", "user_id");
    await wipe("member_stamps", "user_id");
    await wipe("member_details", "user_id");
    await wipe("member_phone", "user_id");
    await wipe("payments", "user_id");
    await wipe("push_subscriptions", "user_id");
    await wipe("profiles", "id");

    const { error } = await sb.auth.admin.deleteUser(user_id);
    if (error) return res.status(502).json({ error: error.message || "Could not delete the account." });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
