#!/bin/bash
echo "=== Test 1: Direct m3u8 from IPTV ==="
RAW_M3U8=$(curl -s -H "User-Agent: VLC/3.0.20 LibVLC/3.0.20" "http://myhand.org:8080/live/3302196097/2474044847/46336.m3u8")
echo "$RAW_M3U8" | head -8

echo ""
echo "=== Test 2: Direct segment from IPTV ==="
SEG=$(echo "$RAW_M3U8" | grep -v '^#' | head -1)
echo "Raw segment path: $SEG"

# Try fetching segment with full IPTV URL
echo "Fetching: http://myhand.org:8080${SEG}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: VLC/3.0.20 LibVLC/3.0.20" "http://myhand.org:8080${SEG}")
echo "Direct HTTP status: $HTTP"

echo ""
echo "=== Test 3: Direct .ts stream (non-HLS) ==="
TS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 -H "User-Agent: VLC/3.0.20 LibVLC/3.0.20" "http://myhand.org:8080/live/3302196097/2474044847/46336.ts")
echo ".ts stream HTTP: $TS_HTTP"
