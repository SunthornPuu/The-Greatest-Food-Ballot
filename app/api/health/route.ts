import { NextResponse } from "next/server";
import { health } from "@/lib/model-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json(await health());
  } catch (e) {
    return NextResponse.json({ status: "down", detail: (e as Error).message }, { status: 503 });
  }
}
