@echo off
echo ========================================
echo Testing Iraqi IPTV Channels
echo ========================================
echo.

set "working=0"
set "failed=0"
set "total=0"

echo Testing channels...
echo.

REM Test each channel
call :test_channel "ABNsat" "https://mediaserver.abnvideos.com/streams/abnsat.m3u8"
call :test_channel "Afarin Baxcha" "https://5dcabf026b188.streamlock.net/afarinTV/livestream/playlist.m3u8"
call :test_channel "Afarin TV" "https://65f16f0fdfc51.streamlock.net/afarinTV/livestream/playlist.m3u8"
call :test_channel "Al Iraqia" "https://cdn.catiacast.video/abr/8d2ffb0aba244e8d9101a9488a7daa05/playlist.m3u8"
call :test_channel "Al Iraqia News" "https://cdn.catiacast.video/abr/78054972db7708422595bc96c6e024ac/playlist.m3u8"
call :test_channel "Al Rasheed TV" "https://media1.livaat.com/static/AL-RASHEED-HD/playlist.m3u8"
call :test_channel "Al-Aimma TV" "https://alaimma.tv/live/index.m3u8"
call :test_channel "Al-Jawadain TV" "https://live.aljawadain.org/live/aljawadaintv/playlist.m3u8"
call :test_channel "Al-Sharqiya" "https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8"
call :test_channel "Al-Sharqiya News" "https://5d94523502c2d.streamlock.net/alsharqiyalive/mystream/playlist.m3u8"
call :test_channel "Alhurra" "https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038900/MBN_Alhurra_Worldsafe_HLS/master.m3u8"
call :test_channel "Alhurra Iraq" "https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038899/MBN_Iraq_Worldsafe_HLS/master.m3u8"
call :test_channel "Alquran" "https://ktvlive.online/stream/hls/ch1.m3u8"
call :test_channel "AVA Family" "https://familyhls.avatv.live/hls/stream.m3u8"
call :test_channel "Avar TV" "https://avr.host247.net/live/AvarTv/playlist.m3u8"
call :test_channel "Bayyinat TV" "https://nl2.livekadeh.com/hls2/Bayyinat.m3u8"
call :test_channel "BeitolAbbas TV" "https://live.beitolabbas.tv/live/beitolabbastv.m3u8"
call :test_channel "Channel 8 Kurdish" "https://live.channel8.com/Channel8-Kurdish/index.fmp4.m3u8"
call :test_channel "Dijlah TV" "https://ghaasiflu.online/Dijlah/index.m3u8"
call :test_channel "EmanTv" "https://avr.host247.net/live/emantv/playlist.m3u8"
call :test_channel "FarmodaTV" "https://avr.host247.net/live/FarmodaTV/playlist.m3u8"
call :test_channel "Imam Hussein TV 1" "https://live.imamhossaintv.com/live/ih1.m3u8"
call :test_channel "Imam Hussein TV 2" "https://live.imamhossaintv.com/live/ih2.m3u8"
call :test_channel "Imam Hussein TV 3" "https://live.imamhossaintv.com/live/ih3.m3u8"
call :test_channel "Imam Hussein TV 4" "https://live.imamhossaintv.com/live/ih4.m3u8"
call :test_channel "iNEWS TV" "https://live.i-news.tv/hls/stream.m3u8"
call :test_channel "Iraq Future" "https://viewmedia7219.bozztv.com/wmedia/viewmedia100/web_040/Stream/playlist.m3u8"
call :test_channel "Kurd Channel" "https://kurdchhls.wns.live/hls/stream.m3u8"
call :test_channel "Kurdistan 24" "https://d1x82nydcxndze.cloudfront.net/live/index.m3u8"
call :test_channel "Kurdistan TV" "https://5a3ed7a72ed4b.streamlock.net/live/SMIL:myStream.smil/playlist.m3u8"
call :test_channel "KurdMax Music" "https://6476e46b58f91.streamlock.net/music/MUSIC2402/playlist.m3u8"
call :test_channel "KurdMax Show" "https://6476e46b58f91.streamlock.net/liveTrans/SHOWS123/playlist.m3u8"
call :test_channel "KurdMax Sorani" "https://6476e46b58f91.streamlock.net/liveTrans/KURDS2211/playlist.m3u8"
call :test_channel "Kurdsat" "https://iko-live.akamaized.net/KurdsatTV/master.m3u8"
call :test_channel "Kurdsat News" "https://hlspackager.akamaized.net/live/DB/KURDSAT_NEWS/HLS/KURDSAT_NEWS.m3u8"
call :test_channel "Marjaeyat TV Arabic" "https://livefa.marjaeyattv.com/mtv_ar/playlist.m3u8"
call :test_channel "Marjaeyat TV English" "https://livefa.marjaeyattv.com/mtv_en/playlist.m3u8"
call :test_channel "Marjaeyat TV Persian" "https://livefa.marjaeyattv.com/mtv_fa/playlist.m3u8"
call :test_channel "MBC Iraq" "https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-iraq/e38c44b1b43474e1c39cb5b90203691e/index.m3u8"
call :test_channel "Mixkurdy" "https://avr.host247.net/live/Mix-kurdy/playlist.m3u8"
call :test_channel "NRT TV" "https://media.streambrothers.com:1936/8226/8226/playlist.m3u8"
call :test_channel "NUBAR Plus TV" "http://stream.nubar.tv:1935/private/NUBARPlus/playlist.m3u8"
call :test_channel "Payam TV" "https://media2.streambrothers.com:1936/8218/8218/playlist.m3u8"
call :test_channel "Rudaw TV" "https://svs.itworkscdn.net/rudawlive/rudawlive.smil/playlist.m3u8"
call :test_channel "Shams TV" "https://stream.shams.tv/hls/stream.m3u8"
call :test_channel "UTV" "https://mn-nl.mncdn.com/utviraqi2/64c80359/index.m3u8"
call :test_channel "Waar TV" "https://live.kwikmotion.com/waarmedialive/waarmedia.smil/waarmediapublish/waarmedia_source/chunks.m3u8"
call :test_channel "Zagros" "https://5a3ed7a72ed4b.streamlock.net/zagrostv/SMIL:myStream.smil/playlist.m3u8"

echo.
echo ========================================
echo Test Results:
echo ========================================
echo Total Channels: %total%
echo Working: %working%
echo Failed: %failed%
echo ========================================
pause
exit /b

:test_channel
set /a total+=1
set "name=%~1"
set "url=%~2"
echo [%total%] Testing: %name%

curl -s -I -m 5 "%url%" | find "200" >nul 2>&1
if %errorlevel% equ 0 (
    echo     [OK] Working
    set /a working+=1
) else (
    curl -s -I -m 5 "%url%" | find "302" >nul 2>&1
    if %errorlevel% equ 0 (
        echo     [OK] Working ^(Redirect^)
        set /a working+=1
    ) else (
        echo     [FAIL] Not working
        set /a failed+=1
    )
)
exit /b
