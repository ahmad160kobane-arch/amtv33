@echo off
ssh root@62.171.153.204 "curl -s --max-time 8 http://ex2025.cc/live/ledyxpro24/2943689/475131.m3u8 | head -10 && echo --- && curl -sI --max-time 8 http://ex2025.cc/live/ledyxpro24/2943689/475197.m3u8 | grep HTTP"
