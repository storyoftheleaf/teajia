# Dedicated i64os service SSH entry on the Windows studio machine.
# Installed as an authorized_keys forced command. Never execute the original
# SSH command as shell text. Prompt input is stdin, never a command argument.
param([switch]$ValidateOnly)

function Resolve-RepairCommand {
  param([string]$Command)
  $probe = 'claude --version; gh auth status >/dev/null 2>&1 && echo GH_OK || echo GH_NO'
  $incidentTools = 'Bash(git:*) Bash(gh:*) Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(ls:*) Bash(cat:*) Bash(mktemp:*) Bash(mkdir:*) Bash(pwd:*) Bash(sleep:*) Read Edit Write Glob Grep'
  $meterTools = 'Bash(git:*) Bash(gh:*) Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(ls:*) Bash(cat:*) Read Edit Write Glob Grep'
  if ($Command -ceq $probe) { return @{ Kind = 'probe' } }
  $pattern = '\Aclaude -p --output-format text --permission-mode acceptEdits --allowedTools "([^"\r\n]+)" --max-turns ([1-9][0-9]{0,2})\z'
  if ($Command -cmatch $pattern) {
    $tools = $Matches[1]; $turns = [int]$Matches[2]
    if (($tools -ceq $incidentTools -or $tools -ceq $meterTools) -and $turns -le 150) {
      return @{ Kind = 'repair'; Tools = $tools; Turns = $turns }
    }
  }
  $prPattern = "\Agh pr (checks|merge) '(https://github\.com/(?:storyoftheleaf/teajia|technicianofthesacred/i64os)/pull/[1-9][0-9]*)'( --squash)?\z"
  if ($Command -cmatch $prPattern) {
    $operation = $Matches[1]; $url = $Matches[2]; $suffix = $Matches[3]
    if (($operation -ceq 'checks' -and !$suffix) -or ($operation -ceq 'merge' -and $suffix -ceq ' --squash')) {
      return @{ Kind = $operation; Url = $url }
    }
  }
  throw 'SSH command is outside the repair contract'
}

function Invoke-RepairCommand {
  param($Parsed)
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  $claude = Join-Path $env:APPDATA 'npm\claude.cmd'
  $gh = 'C:\Program Files\GitHub CLI\gh.exe'
  if ($Parsed.Kind -eq 'probe') {
    if (!(Test-Path $claude) -or !(Test-Path $gh)) { exit 1 }
    & $claude --version
    if ($LASTEXITCODE -ne 0) { exit 1 }
    $authText = (& $claude auth status --json 2>$null | Out-String)
    try { $auth = $authText | ConvertFrom-Json } catch { exit 1 }
    if (!$auth.loggedIn) { exit 1 }
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    $bash = if ($env:CLAUDE_CODE_GIT_BASH_PATH) { $env:CLAUDE_CODE_GIT_BASH_PATH } else { 'C:\Program Files\Git\bin\bash.exe' }
    if (!$git -or !(Test-Path -LiteralPath $bash)) { exit 1 }
    & $git.Source --version
    if ($LASTEXITCODE -ne 0) { exit 1 }
    & $bash -lc 'printf GIT_BASH_OK'
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Output ''
    # gh auth status fails when an UNUSED saved account has an expired token.
    # Check the active credential against the exact repair repositories instead.
    foreach ($repo in @('storyoftheleaf/teajia', 'technicianofthesacred/i64os')) {
      $push = (& $gh api ('repos/' + $repo) --jq '.permissions.push' 2>$null | Out-String).Trim()
      if ($LASTEXITCODE -ne 0 -or $push -cne 'true') { Write-Output 'GH_NO'; exit 1 }
    }
    Write-Output 'GH_OK'; exit 0
    Write-Output 'GH_NO'; exit 1
  }
  if ($Parsed.Kind -eq 'repair') {
    $brief = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($brief) -or $brief.Length -gt 65536) { throw 'Repair brief is empty or too large' }
    # Never start an agent in an unrelated checkout. Its bounded brief names
    # the approved repository and tells it to clone into a fresh subdirectory.
    $work = Join-Path $env:LOCALAPPDATA 'i64os-repair-work'
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    Set-Location -LiteralPath $work
    $brief | & $claude -p --output-format text --permission-mode acceptEdits --allowedTools $Parsed.Tools --max-turns $Parsed.Turns
    exit $LASTEXITCODE
  }
  if ($Parsed.Kind -eq 'checks') { & $gh pr checks $Parsed.Url; exit $LASTEXITCODE }
  if ($Parsed.Kind -eq 'merge') {
    # The receiver only issues this after its owner-tap authorization. This
    # wrapper preserves that contract; it never originates a merge request.
    & $gh pr merge $Parsed.Url --squash
    exit $LASTEXITCODE
  }
  throw 'Unsupported repair operation'
}

# Dot-sourcing exports only the pure validator for offline fixture tests.
if ($MyInvocation.InvocationName -ne '.') {
  try {
    $parsed = Resolve-RepairCommand -Command $env:SSH_ORIGINAL_COMMAND
    if ($ValidateOnly) { $parsed | ConvertTo-Json -Compress; exit 0 }
    Invoke-RepairCommand -Parsed $parsed
  } catch {
    # No command or brief echo: inputs may contain confidential incident text.
    [Console]::Error.WriteLine('Repair SSH command refused or execution failed')
    exit 126
  }
}
