import { NextRequest, NextResponse } from 'next/server';

const VPS = 'http://62.171.153.204:8090';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const res = await fetch(`${VPS}/api/lulu/stream?${searchParams.toString()}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ available: false });
  }
}
