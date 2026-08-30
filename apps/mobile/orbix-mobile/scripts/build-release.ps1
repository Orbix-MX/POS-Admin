<#
.SYNOPSIS
    Compila el APK de release de orbix-mobile.

.DESCRIPTION
    Envuelve `gradlew assembleRelease` para cubrir las tres trampas que documenta
    docs/build-android-release.md y que se olvidan justo cuando importan:

    1. `reactNativeArchitectures` está fijado a x86_64 para poder compilar en
       Windows (bug de ninja con armeabi-v7a). Un APK así NO se instala en un
       móvil real. -Device lo cambia a arm64 solo para este build, sin tocar el
       fichero.
    2. Gradle no considera .env una entrada de
       :app:createBundleReleaseJsAndAssets, así que tras cambiarlo reusa el
       bundle anterior marcándolo UP-TO-DATE, con la URL vieja ya empotrada y
       sin avisar. -Fresh borra ese bundle antes de compilar.
    3. android/ no está en git: la genera `expo prebuild`, y con ella se pierden
       los parches manuales. Si falta, se avisa en vez de fallar dentro de Gradle.

.PARAMETER Device
    Compila para móvil real (arm64-v8a,x86_64) además del emulador.

.PARAMETER Abi
    Lista de ABIs a medida. Manda sobre -Device.

.PARAMETER Fresh
    Borra el bundle JS anterior para que se regenere con el .env actual.

.EXAMPLE
    .\scripts\build-release.ps1
    .\scripts\build-release.ps1 -Device
    .\scripts\build-release.ps1 -Fresh -Abi arm64-v8a
#>
[CmdletBinding()]
param(
    [switch]$Device,
    [string]$Abi,
    [switch]$Fresh
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot 'android'
$apkPath = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'

if (-not (Test-Path $androidDir)) {
    Write-Error @'
No existe android/. La genera `expo prebuild --platform android --no-install`,
y después hay que reaplicar los parches de docs/build-android-release.md.
'@
    exit 1
}

# Sin -Abi explícito: arm64 + x86_64 con -Device, y si no, lo que diga
# gradle.properties (no se pasa -P, para respetar el fichero).
$abis = $null
if ($Abi) {
    $abis = $Abi
} elseif ($Device) {
    $abis = 'arm64-v8a,x86_64'
}

if ($Fresh) {
    $stale = @(
        'app\build\generated\assets\createBundleReleaseJsAndAssets',
        'app\build\intermediates\sourcemaps'
    )
    foreach ($rel in $stale) {
        $full = Join-Path $androidDir $rel
        if (Test-Path $full) { Remove-Item $full -Recurse -Force }
    }
    Write-Host 'Bundle JS anterior borrado: se regenerara con el .env actual.'
}

$gradleArgs = @('assembleRelease', '--no-daemon')
if ($abis) { $gradleArgs += "-PreactNativeArchitectures=$abis" }

Write-Host ''
Write-Host ".\gradlew.bat $($gradleArgs -join ' ')"
Write-Host ''

Push-Location $androidDir
try {
    & .\gradlew.bat @gradleArgs
    $gradleExit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($gradleExit -ne 0) { exit $gradleExit }

$sizeMb = [math]::Round((Get-Item $apkPath).Length / 1MB, 1)
Write-Host ''
Write-Host "APK: $apkPath  ($sizeMb MB)"

# El aviso va al final a proposito: al principio se pierde bajo la salida de
# Gradle, y este es el error que solo se descubre con el movil en la mano.
$effectiveAbis = $abis
if (-not $effectiveAbis) {
    $props = Join-Path $androidDir 'gradle.properties'
    if (Test-Path $props) {
        $match = Select-String -Path $props -Pattern '^reactNativeArchitectures=(.+)$' | Select-Object -First 1
        if ($match) { $effectiveAbis = $match.Matches[0].Groups[1].Value.Trim() }
    }
}

if ($effectiveAbis -and $effectiveAbis -notmatch 'arm64-v8a') {
    Write-Host ''
    Write-Warning "Compilado solo para $effectiveAbis. Sirve para el emulador; un movil real es arm64-v8a y lo rechazara. Usa -Device para incluirlo."
}

Write-Host 'Firmado con el debug.keystore: pruebas internas, no Play Store.'
Write-Host ''
