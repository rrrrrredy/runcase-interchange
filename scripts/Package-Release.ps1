param(
  [string]$Version = "",
  [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$outputRoot = if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  Join-Path $repositoryRoot "artifacts"
} else {
  [System.IO.Path]::GetFullPath($OutputDirectory)
}
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

Push-Location $repositoryRoot
try {
  $status = (git status --porcelain=v1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw "The checkout is not a Git repository." }
  if ($status.Length -gt 0) { throw "Release packaging requires a clean Git checkout." }

  $package = Get-Content -LiteralPath (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json
  $resolvedVersion = if ([string]::IsNullOrWhiteSpace($Version)) { [string]$package.version } else { $Version }
  if ($resolvedVersion -ne $package.version) {
    throw "Requested version $resolvedVersion does not match package.json version $($package.version)."
  }

  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
  npm run check
  if ($LASTEXITCODE -ne 0) { throw "Protocol checks failed." }
  $packageArchive = Join-Path $outputRoot "runcase-interchange-$resolvedVersion.tgz"
  $schemaArchive = Join-Path $outputRoot "runcase-interchange-schemas-$resolvedVersion.zip"
  $manifestPath = Join-Path $outputRoot "release-manifest.json"
  $checksumPath = Join-Path $outputRoot "SHA256SUMS.txt"
  foreach ($existing in @($packageArchive, $schemaArchive, $manifestPath, $checksumPath)) {
    if (Test-Path -LiteralPath $existing -PathType Leaf) { Remove-Item -LiteralPath $existing -Force }
  }

  npm pack --pack-destination $outputRoot
  if ($LASTEXITCODE -ne 0) { throw "npm pack failed." }
  if (-not (Test-Path -LiteralPath $packageArchive -PathType Leaf)) {
    throw "npm pack did not create the expected archive: $packageArchive"
  }

  Compress-Archive -LiteralPath @(
    (Join-Path $repositoryRoot "schemas"),
    (Join-Path $repositoryRoot "examples"),
    (Join-Path $repositoryRoot "docs"),
    (Join-Path $repositoryRoot "README.md"),
    (Join-Path $repositoryRoot "LICENSE"),
    (Join-Path $repositoryRoot "NOTICE")
  ) -DestinationPath $schemaArchive

  $commit = (git rev-parse HEAD | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') { throw "Could not resolve the release commit." }
  $artifacts = @($packageArchive, $schemaArchive) | ForEach-Object {
    @{
      file = [System.IO.Path]::GetFileName($_)
      sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
      bytes = (Get-Item -LiteralPath $_).Length
    }
  }
  $manifest = [ordered]@{
    schema_version = "runcase-interchange.release.v1"
    version = $resolvedVersion
    commit = $commit
    node_version = (& node --version | Out-String).Trim()
    npm_version = (& npm --version | Out-String).Trim()
    created_at = [DateTime]::UtcNow.ToString("o")
    artifacts = $artifacts
  } | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($manifestPath, "$manifest`n", [Text.UTF8Encoding]::new($false))

  $checksumLines = @($packageArchive, $schemaArchive, $manifestPath) | ForEach-Object {
    $hash = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([System.IO.Path]::GetFileName($_))"
  }
  [System.IO.File]::WriteAllText($checksumPath, "$($checksumLines -join "`n")`n", [Text.UTF8Encoding]::new($false))
} finally {
  Pop-Location
}

Write-Host "Release artifacts: $outputRoot"
Write-Host "Checksums: $(Join-Path $outputRoot 'SHA256SUMS.txt')"
