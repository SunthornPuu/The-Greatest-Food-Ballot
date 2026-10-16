// Verifies the Supabase setup: npm run check:supabase
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failed++; console.log(`  ✗ ${m}`); };

if (!url || !anonKey || !serviceKey) {
  console.log("Missing env vars. Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

console.log("Database");
{
  const { error } = await admin.from("ballots").select("id, processed_path, analysis, hidden").limit(1);
  error ? bad(`table ballots: ${error.message} (did you run supabase/schema.sql?)`) : ok("table ballots (with processed_path, analysis)");
}
for (const view of ["rankings", "ballot_stats"]) {
  const { error } = await anon.from(view).select("*").limit(1);
  error ? bad(`view ${view} (anon): ${error.message}`) : ok(`view ${view} readable by anon`);
}
{
  const { error } = await anon.from("ballots").insert({ image_path: "x", thumb_path: "x", prediction: 1 });
  error ? ok("anon cannot insert (RLS on)") : bad("anon CAN insert: RLS is not enabled!");
}

console.log("Storage");
const path = `thumb/_check-${Date.now()}.jpg`;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
{
  const { error } = await admin.storage.from("ballots").upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) bad(`upload to bucket "ballots": ${error.message}`);
  else {
    ok("service role can upload");
    const res = await fetch(`${url}/storage/v1/object/public/ballots/${path}`);
    res.ok ? ok("public URL readable") : bad(`public URL returned ${res.status}: is the bucket public?`);
    const { error: rmErr } = await admin.storage.from("ballots").remove([path]);
    rmErr ? bad(`remove: ${rmErr.message}`) : ok("service role can delete");
  }
}

console.log("Realtime");
await new Promise((resolve) => {
  const ch = anon.channel("check").on("postgres_changes", { event: "INSERT", schema: "public", table: "ballots" }, () => {});
  const t = setTimeout(() => { bad("realtime subscribe timed out"); resolve(); }, 8000);
  ch.subscribe((status, err) => {
    if (status === "SUBSCRIBED") { ok("anon can subscribe to ballots inserts"); clearTimeout(t); anon.removeChannel(ch); resolve(); }
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { bad(`realtime: ${status} ${err?.message ?? ""}`); clearTimeout(t); resolve(); }
  });
});

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll good. Supabase is ready.");
process.exit(failed ? 1 : 0);
