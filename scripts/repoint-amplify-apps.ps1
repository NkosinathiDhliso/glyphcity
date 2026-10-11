# One-time fix after the GitHub rename areaCode -> glyphcity.
#
# The four Amplify apps still reference the old repo URL, and that name now
# belongs to the new Area Code site repo, so GitHub no longer redirects it.
# This points each app at NkosinathiDhliso/glyphcity. Amplify needs a GitHub
# token to change an app's repository; it is read without echo, used in memory
# only, and cleared at the end. Run this yourself.

param(
    [string]$Region = 'us-east-1',
    [string]$Repository = 'https://github.com/NkosinathiDhliso/glyphcity'
)

$ErrorActionPreference = 'Stop'

# Same app IDs as scripts/update-all-amplify-apps.ps1.
$apps = @(
    @{ Name = 'Web (Main)'; AppId = 'd3pm78r41ma6w6' },
    @{ Name = 'Admin'; AppId = 'd1ay6jict0ql9w' },
    @{ Name = 'Business'; AppId = 'dbp54yxhyjvk0' },
    @{ Name = 'Staff'; AppId = 'd166bb81tg4k61' }
)

$secure = Read-Host 'GitHub token (classic, scopes: repo, admin:repo_hook)' -AsSecureString
if ($secure.Length -eq 0) { throw 'No token entered. Paste it with right-click, then press Enter.' }

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
    if (-not ($token -match '^(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,})$')) {
        throw "That is not a GitHub token ($($token.Length) characters). A classic token is 40 characters starting with ghp_. Copy it again with the copy button next to it on GitHub."
    }
    foreach ($app in $apps) {
        Write-Host "Pointing $($app.Name) ($($app.AppId)) at $Repository..."
        aws amplify update-app `
            --app-id $app.AppId `
            --repository $Repository `
            --access-token $token `
            --region $Region | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "update-app failed for $($app.Name); see the error above." }
    }
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $token = $null
}

Write-Host ''
Write-Host 'All four apps now point at glyphcity.' -ForegroundColor Green
aws amplify list-apps --region $Region --query 'apps[].{name:name,repo:repository}' --output table
