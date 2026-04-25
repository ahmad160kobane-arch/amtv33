import { NextResponse } from 'next/server';

const VPS = 'http://62.171.153.204:8090';

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/lulu/home`, { next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ latestMovies: [], latestSeries: [] });
  }
}
