[CmdletBinding()]
param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$automationDir = Join-Path $projectRoot "automation"
$promptPath = Join-Path $automationDir "development-cycle-prompt.md"
$logDir = Join-Path $automationDir "logs"
$lockPath = Join-Path $automationDir "development-cycle.lock"
$lastMessagePath = Join-Path $automationDir "last-message.txt"
$codexCommand = Join-Path $env:APPDATA "npm\codex.ps1"

if (-not (Test-Path -LiteralPath $promptPath -PathType Leaf)) {
  throw "Automation prompt was not found at $promptPath"
}

if (-not (Test-Path -LiteralPath $codexCommand -PathType Leaf)) {
  throw "Codex CLI was not found at $codexCommand"
}

if ($DryRun) {
  [pscustomobject]@{
    ProjectRoot = $projectRoot
    PromptPath = $promptPath
    CodexCommand = $codexCommand
    Interval = "4 hours"
    Sandbox = "workspace-write"
    ApprovalPolicy = "never"
  } | Format-List
  exit 0
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$lockStream = $null
try {
  try {
    $lockStream = [System.IO.File]::Open(
      $lockPath,
      [System.IO.FileMode]::OpenOrCreate,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
  } catch [System.IO.IOException] {
    Write-Output "An AuditSentry development cycle is already running. This cycle will be skipped."
    exit 0
  }

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  $runLog = Join-Path $logDir "$timestamp.log"
  $prompt = Get-Content -Raw -LiteralPath $promptPath

  Push-Location $projectRoot
  try {
    $prompt | & $codexCommand `
      --ask-for-approval never `
      --sandbox workspace-write `
      --cd $projectRoot `
      --config 'model_reasoning_effort="medium"' `
      exec `
      --ephemeral `
      --color never `
      --output-last-message $lastMessagePath `
      - 2>&1 | Tee-Object -FilePath $runLog

    $codexExitCode = $LASTEXITCODE
    if ($codexExitCode -ne 0) {
      throw "Codex development cycle exited with code $codexExitCode. See $runLog"
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($null -ne $lockStream) {
    $lockStream.Dispose()
  }
}
