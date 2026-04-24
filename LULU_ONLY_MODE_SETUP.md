# Lulustream-Only Mode Setup

## ✅ Changes Made

### 1. Modified `cloud-server/server.js`
- **Removed**: Dynamic Lulu catalog building from API (was hitting 5000 req/day limit)
- **Added**: Static catalog loading from `data/lulu_catalog.json`
- **Added**: `/api/lulu/reload` admin endpoint to reload catalog after updates
- **Disabled**: VidSrc and Xtream VOD endpoints (commented out)
- **Kept**: Lulu endpoints only:
  - `/api/lulu/home` - Homepage with latest movies/series
  - `/api/lulu/list` - Browse movies or series with pagination
  - `/api/lulu/detail` - Get details for a specific item
  - `/api/lulu/stream` - Get stream URL for playback

### 2. Created `build_catalog.js`
- Standalone script to build Lulu catalog offline
- Saves to `/root/ma-streaming/cloud-server/data/lulu_catalog.json`
- Optionally saves to PostgreSQL database
- Handles rate limiting with delays (1.2s between requests)
- Saves incremental progress every 20 items

## 📋 Current Status

### ⚠️ Rate Limit Hit
- Lulu API: **5000 requests/day limit reached**
- Catalog build must wait until limit resets (tomorrow)
- Current catalog: **0 items** (file doesn't exist yet)

### ✅ Files Uploaded to VPS
- `/root/ma-streaming/cloud-server/server.js` - Modified server
- `/root/ma-streaming/build_catalog.js` - Catalog builder script

## 🔧 Next Steps

### Step 1: Build Catalog (When Rate Limit Resets)
```bash
# SSH to VPS
ssh root@62.171.153.204

# Run catalog builder (will take 30-60 minutes)
cd /root/ma-streaming
nohup node build_catalog.js > catalog_build.log 2>&1 &

# Monitor progress
tail -f catalog_build.log

# Check result
ls -lh cloud-server/data/lulu_catalog.json
```

### Step 2: Restart Cloud Server
```bash
# After catalog is built
pm2 restart cloud-server

# Check logs
pm2 logs cloud-server --lines 50
```

### Step 3: Verify Catalog Loaded
```bash
# Should see: "[Lulu] ✅ Static catalog loaded: XXX items"
pm2 logs cloud-server | grep Lulu
```

### Step 4: Test Endpoints
```bash
# Test home endpoint
curl http://localhost:8090/api/lulu/home

# Test list endpoint
curl "http://localhost:8090/api/lulu/list?type=movie&page=1"
```

## 🔄 Updating Catalog

### Manual Update (When New Content Added to Lulustream)
```bash
# 1. Run catalog builder again
cd /root/ma-streaming
node build_catalog.js

# 2. Reload catalog in running server (no restart needed)
curl -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  http://localhost:8090/api/lulu/reload
```

### Automated Daily Update (Optional)
```bash
# Add to crontab
crontab -e

# Run at 3 AM daily (when rate limit resets)
0 3 * * * cd /root/ma-streaming && node build_catalog.js >> /var/log/lulu_catalog.log 2>&1
```

## 📊 Expected Catalog Size

Based on Lulu root folder (ID: 74466):
- **Estimated items**: 100-500 movies/series
- **Build time**: 30-60 minutes (with rate limiting)
- **File size**: ~500KB - 2MB JSON
- **API calls**: ~100-500 (well under 5000/day limit)

## 🎯 Benefits of Static Catalog

### ✅ Advantages
1. **No rate limits** - Catalog loaded from file, not API
2. **Instant response** - No API calls on every request
3. **Predictable** - Same content for all users
4. **Reliable** - Works even if Lulu API is down
5. **Fast** - No network latency

### ⚠️ Considerations
1. **Manual updates** - Need to rebuild catalog for new content
2. **Stale data** - Catalog may be outdated until rebuilt
3. **Initial build** - Takes time to create first catalog

## 🔍 Troubleshooting

### Catalog Not Loading
```bash
# Check if file exists
ls -lh /root/ma-streaming/cloud-server/data/lulu_catalog.json

# Check file content
head -20 /root/ma-streaming/cloud-server/data/lulu_catalog.json

# Check server logs
pm2 logs cloud-server | grep -i lulu
```

### Rate Limit Errors
```bash
# Check when limit resets (usually 24 hours)
# Wait and try again tomorrow

# Or use smaller batch size in build_catalog.js
# Edit: BATCH_DELAY from 1200ms to 2000ms
```

### Empty Catalog
```bash
# Verify Lulu API key and root folder ID
grep -E "KEY|ROOT" /root/ma-streaming/build_catalog.js

# Test API manually
curl "https://api.lulustream.com/api/folder/list?key=268476xsqgnehs76lhfq0q&fld_id=74466&page=1&per_page=10"
```

## 📝 Configuration

### Lulu API Settings (in build_catalog.js)
```javascript
const KEY = '268476xsqgnehs76lhfq0q';  // Lulu API key
const ROOT = 74466;                     // Root folder ID
const OUT = '/root/ma-streaming/cloud-server/data/lulu_catalog.json';
```

### Rate Limiting
```javascript
await sleep(1200);  // 1.2s between requests = ~50 req/min
```

## 🎬 Web App Integration

The web app should use these endpoints:
- **Homepage**: `GET /api/lulu/home`
- **Browse Movies**: `GET /api/lulu/list?type=movie&page=1`
- **Browse Series**: `GET /api/lulu/list?type=series&page=1`
- **Search**: `GET /api/lulu/list?type=movie&search=query`
- **Details**: `GET /api/lulu/detail?id={fld_id}`
- **Stream**: `GET /api/lulu/stream?file_code={code}`

## ⏰ Timeline

1. **Now**: Server configured for static catalog mode
2. **Tomorrow**: Rate limit resets, build catalog
3. **After build**: Restart server, verify catalog loaded
4. **Ongoing**: Update catalog weekly or when new content added

## 📞 Support

If issues persist:
1. Check PM2 logs: `pm2 logs cloud-server`
2. Check catalog file: `cat /root/ma-streaming/cloud-server/data/lulu_catalog.json | jq '.catalog | length'`
3. Test Lulu API: `curl "https://api.lulustream.com/api/folder/list?key=...&fld_id=74466"`
