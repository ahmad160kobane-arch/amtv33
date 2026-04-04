@echo off
ssh root@62.171.153.204 "echo '=== .ts stream ===' && curl -sI --max-time 8 http://ex2025.cc/live/ledyxpro24/2943689/404312.ts | head -8 && echo --- && echo '=== .ts actual data ===' && curl -s --max-time 3 http://ex2025.cc/live/ledyxpro24/2943689/404312.ts 2>/dev/null | wc -c"
