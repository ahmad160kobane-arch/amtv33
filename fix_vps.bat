@echo off
ssh root@62.171.153.204 "node -e \"var fs=require('fs'),p='/home/cloud-server/lib/xtream.js',c=fs.readFileSync(p,'utf8');c=c.replace('proxpanel.cc:80','ex2025.cc').replace('proxpanel.fans:8080','ex2025.cc').replace('8691274970','ledyxpro24').replace('5595837537','2943689');fs.writeFileSync(p,c);console.log('DONE');console.log(c.slice(0,250));\""
