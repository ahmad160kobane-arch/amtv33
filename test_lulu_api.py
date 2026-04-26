import urllib.request, json

print("=== فحص backend lulu API ===")

# test /api/lulu/home
try:
    r = urllib.request.urlopen('https://amtv33-production.up.railway.app/api/lulu/home', timeout=15)
    d = json.loads(r.read().decode())
    print(f"lulu/home => movies: {len(d.get('latestMovies',[]))}, series: {len(d.get('latestSeries',[]))}")
except Exception as e:
    print(f"lulu/home ERROR: {e}")

# test /api/lulu/list?type=movie
try:
    r = urllib.request.urlopen('https://amtv33-production.up.railway.app/api/lulu/list?type=movie&page=1', timeout=15)
    d = json.loads(r.read().decode())
    print(f"lulu/list movies => total: {d.get('total')}, items: {len(d.get('items',[]))}, hasMore: {d.get('hasMore')}")
except Exception as e:
    print(f"lulu/list movies ERROR: {e}")

# test /api/lulu/list?type=series
try:
    r = urllib.request.urlopen('https://amtv33-production.up.railway.app/api/lulu/list?type=series&page=1', timeout=15)
    d = json.loads(r.read().decode())
    print(f"lulu/list series => total: {d.get('total')}, items: {len(d.get('items',[]))}, hasMore: {d.get('hasMore')}")
except Exception as e:
    print(f"lulu/list series ERROR: {e}")

# test VPS webapp directly
try:
    r = urllib.request.urlopen('http://62.171.153.204/api/lulu/home', timeout=15)
    d = json.loads(r.read().decode())
    print(f"VPS /api/lulu/home => movies: {len(d.get('latestMovies',[]))}, series: {len(d.get('latestSeries',[]))}")
except Exception as e:
    print(f"VPS /api/lulu/home ERROR: {e}")
