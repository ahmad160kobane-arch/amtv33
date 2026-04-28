import { NextResponse } from "next/server";

const BACKEND = "https://amtv33-production.up.railway.app";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/lulu/genres`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ genres: [] });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ genres: [] });
  }
}
