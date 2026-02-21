@echo off
setlocal
cd /d "%~dp0"

set "FIREBASE_SERVICE_ACCOUNT=C:\Users\thero\Documents\CodexBlog\website-11b5c-firebase-adminsdk-fbsvc-a8dc40d6e2.json"
set "FIREBASE_DATABASE_URL=https://website-11b5c-default-rtdb.firebaseio.com"

if not exist "author.txt" (
  echo author.txt not found. Create author.txt with your author name on the first line.
  exit /b 1
)

set /p AUTHOR=<author.txt
if "%AUTHOR%"=="" (
  echo author.txt is empty. Add your author name to the first line.
  exit /b 1
)

set /p TITLE=Title: 
set /p POST=Content: 

npm run publish -- "%TITLE%" "%AUTHOR%" "%POST%"

endlocal
