#!/bin/bash
echo "=== Testing segment proxy ==="
JSON=$(curl -s http://localhost:8090/api/xtream/stream/46336)
TOKEN_URL=$(echo "$JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).proxyUrl))")

# Get first segment URL from m3u8
SEG_URL=$(curl -s "http://localhost:8090$TOKEN_URL" | grep -v '^#' | head -1)
echo "Segment URL: $SEG_URL"

# Test segment download
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8090$SEG_URL")
echo "Segment HTTP status: $HTTP_CODE"

CONTENT_TYPE=$(curl -s -o /dev/null -w "%{content_type}" "http://localhost:8090$SEG_URL")
echo "Content-Type: $CONTENT_TYPE"

SIZE=$(curl -s -o /dev/null -w "%{size_download}" "http://localhost:8090$SEG_URL")
echo "Downloaded bytes: $SIZE"
