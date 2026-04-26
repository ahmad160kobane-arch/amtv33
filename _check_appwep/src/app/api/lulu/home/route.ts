import { NextResponse } from "next/server";

const BACKEND = "https://amtv33-production.up.railway.app";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/lulu/home`, {
      next: { revalidate: 60 },
    });
    if (!res.ok)
      return NextResponse.json({ latestMovies: [], latestSeries: [] });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ latestMovies: [], latestSeries: [] });
  }
}
