# PowerShell script to sign the desktop executable locally with a self-signed certificate
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Path
)

$ErrorActionPreference = "Stop"

$certSubject = "CN=Agence Local Development"
$certStorePath = "Cert:\CurrentUser\My"
$rootStorePath = "Cert:\CurrentUser\Root"

# Find or create code signing certificate
$cert = Get-ChildItem -Path $certStorePath | Where-Object { $_.Subject -eq $certSubject } | Select-Object -First 1

if (-not $cert) {
    Write-Host "Creating self-signed code signing certificate..."
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $certSubject -CertStoreLocation $certStorePath
    
    Write-Host "Importing certificate to Trusted Root Certification Authorities so Windows trusts it..."
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()
} else {
    Write-Host "Using existing local code signing certificate."
}

# Resolve target files to sign
$filesToSign = @()
if ($Path -and $Path.Count -gt 0) {
    $filesToSign = @($Path | ForEach-Object { Resolve-Path $_ -ErrorAction SilentlyContinue } | Select-Object -ExpandProperty Path -Unique)
} else {
    $distPath = Join-Path (Get-Location) "dist"
    if (Test-Path $distPath) {
        $filesToSign = @(Get-ChildItem -Path $distPath -Filter "*.exe" -Recurse | Select-Object -ExpandProperty FullName)
    }
}

if ($filesToSign.Count -eq 0) {
    Write-Host "No files found to sign."
    exit 0
}

foreach ($file in $filesToSign) {
    Write-Host "Signing: $file"
    Set-AuthenticodeSignature -FilePath $file -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
}

Write-Host "Local signing complete! Windows will now trust the installer on this machine."
