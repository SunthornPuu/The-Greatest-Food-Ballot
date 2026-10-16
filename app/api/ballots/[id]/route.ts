import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({ feedback: z.union([z.literal(1), z.literal(-1)]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "feedback must be 1 or -1" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("ballots")
    .update({ feedback: body.data.feedback })
    .eq("id", id)
    .eq("hidden", false)
    .select("id, feedback")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Couldn't save feedback" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
