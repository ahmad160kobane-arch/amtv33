#!/bin/bash
echo "=== Testing live stream proxy ==="
# Get token URL
JSON=$(curl -s http://localhost:8090/api/xtream/stream/46336)
echo "API response: $JSON"
TOKEN_URL=$(echo "$JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).proxyUrl)}catch(e){console.error(e)}})")
echo "Token URL: $TOKEN_URL"

# Fetch m3u8 through proxy
echo ""
echo "=== M3U8 content (first 15 lines) ==="
curl -s "http://localhost:8090$TOKEN_URL" | head -15

echo ""
echo "=== Checking if /hlsr/ was rewritten ==="
curl -s "http://localhost:8090$TOKEN_URL" | grep -c "/xtream-seg/"
echo "lines contain /xtream-seg/"
curl -s "http://localhost:8090$TOKEN_URL" | grep -c "/hlsr/"
echo "lines contain raw /hlsr/"
