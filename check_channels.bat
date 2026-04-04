@echo off
ssh root@62.171.153.204 "curl -s https://amtv33-production.up.railway.app/api/channels/export | node -e \"var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{var j=JSON.parse(d);console.log('total:',j.total);if(j.channels&&j.channels[0])console.log('first url:',j.channels[0].stream_url);});\""
