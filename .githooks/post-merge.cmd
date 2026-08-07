@echo off
node "%~dp0..\scripts\sync-database.js" || exit /b 0
