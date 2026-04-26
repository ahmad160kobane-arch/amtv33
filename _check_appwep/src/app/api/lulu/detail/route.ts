import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://amtv33-production.up.railway.app";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const res = await fetch(
      `${BACKEND}/api/lulu/detail?${searchParams.toString()}`,
    );
    if (!res.ok) return NextResponse.json(null, { status: 404 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
