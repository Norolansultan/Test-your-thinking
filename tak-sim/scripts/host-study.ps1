# Host the study from this PC for a small test (e.g. three professors), behind an ngrok tunnel (default)
# or a Cloudflare quick tunnel (-Tunnel cloudflare).
#
#   powershell -ExecutionPolicy Bypass -File scripts\host-study.ps1
#
# What it does: checks the Gemini key (asks for it if unset; it is kept in this window only, never
# written to disk), builds the production bundle, generates a fresh ADMIN_TOKEN for this run (printed
# here only, never written to disk), starts the production server on 127.0.0.1:8080, opens the tunnel
# (ngrok: https://<name>.ngrok-free.app, fixed between runs with -Domain; cloudflare: a new
# https://<random>.trycloudflare.com each run), prints the study links, one per allocation stratum
# (<address>/?tuotanto&osite=<profession>.<lead|nolead>, SPEC/30 section 2 revision (bf), 24 Oct 2026) and the
# researcher's data page, and writes the links (not the token) to logs\study-links-<time>.txt.
# Ctrl+C stops the tunnel and the server.
#
# The shared link (docs/DEPLOYMENT.md section 7.1): the server runs with AUTO_ASSIGN=1, and when a
# participant presses start it issues the next unused code of content/assignment/allocation.json in the
# chosen language and the link's stratum, in sequence order; the same browser keeps its code. -Cells restricts the codes to some cells: the default,
# reasoning_intent (Search + guided Thinker, both tools), is the professors' PILOT setting and breaks the
# blocked balance between cells on purpose; use -Cells all for the study's full sequence.
#
# Why ngrok (9 Oct 2026): this PC's Elisa connection does not resolve trycloudflare.com, and a participant
# on an Elisa home connection might not either. ngrok's free plan: 1 GB out a month (the app is ~27 MB
# per participant) and a one-time "You are about to visit" page each participant clicks through.
#
# Limits of a tunnel (docs/DEPLOYMENT.md section 7): without -Domain the address is new on every run, so links
# from an earlier run stop working; the sessions run on this PC, so it must stay on, awake and online
# for as long as anyone is in a session (this script asks Windows not to sleep while it runs; closing
# the lid or a power cut still ends it). A participant's browser keeps every answer, so after an
# interruption the same link on the same browser resumes, but only while this run's address lives.
# For a link that stays the same, give ngrok's free static domain as -Domain.
#
# The data: finished sessions in logs\sessions\<id>.jsonl, checkpoints of unfinished ones in
# logs\sessions\<id>.partial.jsonl, Thinker's logs in logs\thinker\. Download them all from the data
# page printed below, or on this PC: npm run sessions:export -- --out <folder>
#
# Needs: Node 22+, `npm ci` done once, and the tunnel program: ngrok (winget install --id Ngrok.Ngrok,
# then once: ngrok config add-authtoken <token from dashboard.ngrok.com>) or cloudflared
# (winget install --id Cloudflare.cloudflared).

param(
  # The cells the shared link issues codes for (ASSIGN_CELLS): reasoning_intent (the pilot, default),
  # a comma list, or "all" (the blocked sequence as generated: the study).
  [string] $Cells = "reasoning_intent",
  # Advanced: also print one manual ?koodi= link per code given here (codes from
  # content/assignment/allocation.json). Do not mix with the shared link in one run unless you must.
  [string[]] $Codes = @(),
  [int] $Port = 8080,
  # The tunnel: ngrok (default) or cloudflare.
  [ValidateSet("ngrok", "cloudflare")] [string] $Tunnel = "ngrok",
  # ngrok only: the free plan's static domain (dashboard.ngrok.com > Domains), e.g. name.ngrok-free.app,
  # so the link stays the same between runs.
  [string] $Domain = "",
  [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if ($Tunnel -eq "ngrok") {
  $ngrok = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
  if (-not $ngrok) {
    # winget's install locations; a window opened before the install doesn't have it on PATH yet.
    $ngrok = @("$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe") + @(Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_*\ngrok.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName) |
      Where-Object { Test-Path $_ } | Select-Object -First 1
  }
  if (-not $ngrok) {
    Write-Host "ngrok is not installed. Run:  winget install --id Ngrok.Ngrok  and open a new window." -ForegroundColor Red
    exit 1
  }
  # The authtoken lives in ngrok's own config file (ngrok config add-authtoken), never in this repository.
  $ngrokConfig = @("$env:LOCALAPPDATA\ngrok\ngrok.yml", "$env:USERPROFILE\.config\ngrok\ngrok.yml") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $ngrokConfig -or -not (Select-String -Path $ngrokConfig -Pattern "authtoken:" -Quiet)) {
    Write-Host "ngrok has no authtoken yet. Sign up free at https://dashboard.ngrok.com, copy your authtoken and run once:" -ForegroundColor Red
    Write-Host "  ngrok config add-authtoken <your token>" -ForegroundColor Red
    exit 1
  }
} else {
  $cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
  if (-not $cloudflared) {
    # winget's install location; a window opened before the install doesn't have it on PATH yet.
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) { if (Test-Path $p) { $cloudflared = $p; break } }
  }
  if (-not $cloudflared) {
    Write-Host "cloudflared is not installed. Run:  winget install --id Cloudflare.cloudflared  and open a new window." -ForegroundColor Red
    exit 1
  }
}

if (-not $env:GEMINI_API_KEY) {
  $secure = Read-Host "Gemini API key (input hidden; kept in this window only)" -AsSecureString
  $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
# A pasted key often carries quotes or a trailing space; either makes Google reject it.
if ($env:GEMINI_API_KEY) { $env:GEMINI_API_KEY = $env:GEMINI_API_KEY.Trim().Trim('"', "'", [char]0x201C, [char]0x201D).Trim() }
if (-not $env:GEMINI_API_KEY) { Write-Host "No key given: every Haku/Thinker answer would be the template fallback." -ForegroundColor Red; exit 1 }

if (-not $SkipBuild) {
  Write-Host "Building the production bundle (tests first; about 2 minutes)..."
  npm run build:prod
  if ($LASTEXITCODE -ne 0) { Write-Host "build:prod failed; not starting." -ForegroundColor Red; exit 1 }
}

# A new data-download token for this run: 32 random bytes, URL-safe (43 characters). It lives in this
# window's environment (the server inherits it) and on the screen, nowhere else.
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:ADMIN_TOKEN = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

# Keep Windows awake while this script runs (the display may still turn off). Undone when the script ends.
$keptAwake = $false
try {
  Add-Type -Namespace FireSim -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction Stop
  [void][FireSim.Power]::SetThreadExecutionState([uint32]2147483649) # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
  $keptAwake = $true
} catch { Write-Host "Could not ask Windows to stay awake; set Power & sleep to Never while hosting." -ForegroundColor Yellow }

$env:PORT = "$Port"
# The shared link: the server issues the next allocation code when a participant starts (section 7.1).
$env:AUTO_ASSIGN = "1"
if ($Cells -eq "all") { Remove-Item Env:ASSIGN_CELLS -ErrorAction SilentlyContinue } else { $env:ASSIGN_CELLS = $Cells }
$server = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "serve" -NoNewWindow -PassThru
try {
  # Wait for the server to answer.
  $up = $false
  for ($i = 0; $i -lt 90 -and -not $up; $i++) {
    Start-Sleep -Seconds 1
    try { Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2 | Out-Null; $up = $true } catch {}
  }
  if (-not $up) { throw "the server did not start on port $Port" }

  $url = $null
  if ($Tunnel -eq "ngrok") {
    Write-Host "Opening the ngrok tunnel..."
    $log = Join-Path $env:TEMP "fire-sim-ngrok.log"
    if (Test-Path $log) { Remove-Item $log }
    $ngrokArgs = @("http", "http://127.0.0.1:$Port", "--log", "stdout", "--log-format", "logfmt")
    if ($Domain) { $ngrokArgs += @("--url", "https://$($Domain -replace '^https?://', '')") }
    $tunnelProc = Start-Process -FilePath $ngrok -ArgumentList $ngrokArgs -NoNewWindow -PassThru -RedirectStandardOutput $log
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
      Start-Sleep -Seconds 1
      # The agent's local API lists its tunnels once the session is up.
      try {
        $t = (Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2).tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1
        if ($t) { $url = $t.public_url.TrimEnd('/'); break }
      } catch {}
      $failed = if (Test-Path $log) { Select-String -Path $log -Pattern "lvl=(eror|crit)|ERR_NGROK" | Select-Object -First 1 }
      if ($failed) { throw "ngrok failed: $($failed.Line.Trim()). Check the authtoken (ngrok config add-authtoken), the -Domain, and that no other ngrok is running." }
      if ($tunnelProc.HasExited) { throw "ngrok exited before giving an address; see $log" }
    }
    if (-not $url) { throw "no ngrok address after 60 s; see $log" }
  } else {
    Write-Host "Opening the Cloudflare tunnel..."
    $log = Join-Path $env:TEMP "fire-sim-tunnel.log"
    if (Test-Path $log) { Remove-Item $log }
    $tunnelProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$Port" -NoNewWindow -PassThru -RedirectStandardError $log
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
      Start-Sleep -Seconds 1
      if (-not (Test-Path $log)) { continue }
      # The tunnel's own address, not api.trycloudflare.com (which cloudflared calls, and names in its errors).
      $m = Select-String -Path $log -Pattern "https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value; break }
      $failed = Select-String -Path $log -Pattern "failed to request quick Tunnel|no such host|connection refused" | Select-Object -First 1
      if ($failed) { throw "Cloudflare tunnel failed: $($failed.Line.Trim()). Check the internet connection (or a firewall/VPN blocking trycloudflare.com) and try again." }
      if ($tunnelProc.HasExited) { throw "cloudflared exited before giving an address; see $log" }
    }
    if (-not $url) { throw "no tunnel address after 60 s; see $log" }
  }

  # SPEC/30 section 2 revision (bf), 24 Oct 2026: one shared link per allocation stratum (the screener's profession x leads others);
  # recruitment sends each participant the link of the stratum their screener answers put them in (docs/DEPLOYMENT.md section 7.1).
  $strata = @("fire_rescue.lead", "fire_rescue.nolead", "military.lead", "military.nolead", "other.lead", "other.nolead")
  $sharedLinks = @($strata | ForEach-Object { "$url/?tuotanto&osite=$_" })
  $shared = $sharedLinks -join "`n  "
  $links = @($Codes | ForEach-Object { "$url/?tuotanto&koodi=$_" })
  # The participant link (never the token) to logs\ (gitignored), to copy into the e-mails.
  $stamp = Get-Date -Format "yyyyMMdd-HHmm"
  New-Item -ItemType Directory -Force "logs" | Out-Null
  $linksFile = Join-Path "logs" "study-links-$stamp.txt"
  $note = @(
    "Study links of the run started $(Get-Date -Format 'yyyy-MM-dd HH:mm'): one per stratum (profession.leads), the same for everyone in it; each person gets a code of their stratum when they press start.",
    "Cells issued: $Cells. They work only while that run is up: a new run gives a new address.",
    ""
  ) + $sharedLinks
  if ($Codes.Count -gt 0) { $note += @("", "Manual links (advanced):") }
  for ($i = 0; $i -lt $Codes.Count; $i++) { $note += "$($Codes[$i])  $($links[$i])" }
  Set-Content -Path $linksFile -Value $note -Encoding UTF8

  Write-Host ""
  Write-Host "Study links, one per stratum (send each person the link of their screener stratum; each gets their own code when they press start):" -ForegroundColor Green
  Write-Host "  $shared"
  if ($Cells -ne "all") { Write-Host "  PILOT: only $Cells codes are issued (the blocked balance between cells does not hold). Use -Cells all for the study." -ForegroundColor Yellow }
  if ($Codes.Count -gt 0) {
    Write-Host "Manual links (advanced; one per person):"
    foreach ($l in $links) { Write-Host "  $l" }
  }
  Write-Host "  (also written to $linksFile)"
  Write-Host ""
  Write-Host "Your data page (issued codes, their cell and whether each session is complete or partial; keep it private, the token in it is valid for this run only):" -ForegroundColor Cyan
  Write-Host "  $url/admin?token=$($env:ADMIN_TOKEN)"
  Write-Host "  Everything as one archive: $url/api/admin/export.tar?token=$($env:ADMIN_TOKEN)"
  Write-Host ""
  if ($Tunnel -eq "ngrok") { Write-Host "ngrok's free plan shows a one-time 'You are about to visit' page: participants press 'Visit Site' once." -ForegroundColor Yellow }
  Write-Host "$(if ($Domain) { 'This address stays the same while you use -Domain.' } else { 'This address changes on every run.' }) Keep this window open and the PC on and online until everyone has finished;"
  Write-Host "Ctrl+C stops everything. Data stays in logs\sessions\ and logs\thinker\ (npm run sessions:export -- --out <folder>)."
  Wait-Process -Id $tunnelProc.Id
} catch {
  Write-Host "Stopped: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host $_.ScriptStackTrace
  throw
} finally {
  if ($tunnelProc -and $tunnelProc.Id -and -not $tunnelProc.HasExited) { Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue }
  if ($server -and $server.Id -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  if ($keptAwake) { [void][FireSim.Power]::SetThreadExecutionState([uint32]2147483648) } # ES_CONTINUOUS: normal sleep again
  Remove-Item Env:ADMIN_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:AUTO_ASSIGN -ErrorAction SilentlyContinue
  Remove-Item Env:ASSIGN_CELLS -ErrorAction SilentlyContinue
}
