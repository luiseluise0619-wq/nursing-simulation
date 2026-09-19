$ErrorActionPreference = 'Stop'

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'Java 17+ is required. Install Android Studio or a JDK, then run this script again.'
}

if (-not (Test-Path 'android/keystore.properties')) {
    throw 'android/keystore.properties is missing. Create it from the format in LAUNCH_GUIDE.md before making a release build.'
}

npm run build:web
Push-Location android
try {
    .\gradlew.bat bundleRelease
} finally {
    Pop-Location
}

$bundle = Join-Path $PWD 'android/app/build/outputs/bundle/release/app-release.aab'
if (-not (Test-Path $bundle)) {
    throw "Release bundle was not created: $bundle"
}

Write-Host "Upload this file to Google Play Console: $bundle"
