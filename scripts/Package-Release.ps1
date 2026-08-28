param(
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
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
  npm run check
  if ($LASTEXITCODE -ne 0) { throw "Protocol checks failed." }
  npm pack --pack-destination $outputRoot
  if ($LASTEXITCODE -ne 0) { throw "npm pack failed." }

  $schemaArchive = Join-Path $outputRoot "agent-run-protocol-schemas-0.1.0.zip"
  if (Test-Path -LiteralPath $schemaArchive -PathType Leaf) { Remove-Item -LiteralPath $schemaArchive -Force }
  Compress-Archive -LiteralPath @(
    (Join-Path $repositoryRoot "schemas"),
    (Join-Path $repositoryRoot "examples"),
    (Join-Path $repositoryRoot "docs"),
    (Join-Path $repositoryRoot "README.md"),
    (Join-Path $repositoryRoot "LICENSE"),
    (Join-Path $repositoryRoot "NOTICE")
  ) -DestinationPath $schemaArchive
} finally {
  Pop-Location
}

Write-Host "Release artifacts: $outputRoot"
