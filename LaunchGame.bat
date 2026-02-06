@echo off
echo Launching Grand Strategy Game...
set DOTNET_ROOT=C:\tools\dotnet
set PATH=C:\tools\dotnet;%PATH%
C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe --path "E:\world-game"
if errorlevel 1 pause
