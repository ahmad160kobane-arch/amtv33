@echo off
ssh root@62.171.153.204 "sed -i s/proxpanel.cc:80/ex2025.cc/g /home/cloud-server/lib/xtream.js && sed -i s/proxpanel.fans:8080/ex2025.cc/g /home/cloud-server/lib/xtream.js && sed -i s/8691274970/ledyxpro24/g /home/cloud-server/lib/xtream.js && sed -i s/5595837537/2943689/g /home/cloud-server/lib/xtream.js && echo DONE && grep -A5 XTREAM /home/cloud-server/lib/xtream.js | head -8"
