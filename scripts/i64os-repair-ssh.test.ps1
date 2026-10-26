# Offline validator fixtures: never launches Claude, gh, or a repair.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'i64os-repair-ssh.ps1')
$tools = 'Bash(git:*) Bash(gh:*) Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(ls:*) Bash(cat:*) Bash(mktemp:*) Bash(mkdir:*) Bash(pwd:*) Bash(sleep:*) Read Edit Write Glob Grep'
$dispatch = 'claude -p --output-format text --permission-mode acceptEdits --allowedTools "' + $tools + '" --max-turns 150'
$good = @(
  @{ Command = 'claude --version; gh auth status >/dev/null 2>&1 && echo GH_OK || echo GH_NO'; Kind = 'probe' },
  @{ Command = $dispatch; Kind = 'repair' },
  @{ Command = "gh pr checks 'https://github.com/storyoftheleaf/teajia/pull/123'"; Kind = 'checks' },
  @{ Command = "gh pr merge 'https://github.com/technicianofthesacred/i64os/pull/123' --squash"; Kind = 'merge' }
)
foreach ($case in $good) {
  $parsed = Resolve-RepairCommand $case.Command
  if ($parsed.Kind -cne $case.Kind) { throw 'Valid command was parsed incorrectly' }
}
$bad = @(
  'hostname', 'powershell -Command whoami', '',
  ($dispatch + '; whoami'), ($dispatch + "`nwhoami"), ($dispatch + "`n"),
  ($dispatch.Replace('150', '151')), ($dispatch.Replace('150', '0')),
  ($dispatch.Replace('acceptEdits', 'bypassPermissions')),
  ($dispatch.Replace($tools, 'Bash(*)')),
  ($dispatch.Replace($tools, '$(whoami)')),
  "gh pr checks 'https://github.com/other/repo/pull/123'",
  "gh pr checks 'https://github.com/storyoftheleaf/teajia/pull/123' --squash",
  "gh pr merge 'https://github.com/storyoftheleaf/teajia/pull/123'",
  "gh pr merge 'https://github.com/storyoftheleaf/teajia/pull/123' --squash; whoami",
  "gh pr checks 'https://github.com/storyoftheleaf/teajia/pull/123?x=1'"
)
foreach ($command in $bad) {
  $refused = $false
  try { $null = Resolve-RepairCommand $command } catch { $refused = $true }
  if (!$refused) { throw 'Unsafe command was accepted' }
}
Write-Output ('PASS: repair SSH validator (' + $good.Count + ' accepted, ' + $bad.Count + ' refused)')
