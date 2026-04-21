import { NextResponse } from 'next/server';

const VPS = 'http://62.171.153.204:8090';

export async function GET() {
  try {
    const res = await fetch(`${VPS}/api/lulu/home`, { cache: 'no-store' });
    const data = await res.json();
    // لا تُرجع كاش فارغ — فقط كاش إذا في محتوى فعلي
    const hasContent = (data.latestMovies?.length || 0) + (data.latestSeries?.length || 0) > 0;
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': hasContent ? 'public, s-maxage=300, stale-while-revalidate=60' : 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ latestMovies: [], latestSeries: [] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
