import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const carhuntUrl = process.env.CARHUNT_URL;
  const carhuntSecret = process.env.CARHUNT_SECRET;

  if (!carhuntUrl || !carhuntSecret) {
    return NextResponse.json({ error: "CARHUNT_URL or CARHUNT_SECRET not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${carhuntUrl}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${carhuntSecret}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[scraper-run] Could not reach carhunt server:", err);
    return NextResponse.json({ error: "Could not reach carhunt server" }, { status: 502 });
  }
}
