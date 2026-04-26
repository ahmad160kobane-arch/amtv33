import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://amtv33-production.up.railway.app";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const res = await fetch(
      `${BACKEND}/api/lulu/list?${searchParams.toString()}`,
    );
    if (!res.ok)
      return NextResponse.json({
        items: [],
        page: 1,
        total: 0,
        hasMore: false,
      });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ items: [], page: 1, total: 0, hasMore: false });
  }
}
