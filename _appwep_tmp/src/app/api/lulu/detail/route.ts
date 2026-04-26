import { NextRequest, NextResponse } from 'next/server';

const VPS = 'http://62.171.153.204:8090';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const res = await fetch(`${VPS}/api/lulu/detail?${searchParams.toString()}`);
    if (!res.ok) return NextResponse.json(null, { status: 404 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
