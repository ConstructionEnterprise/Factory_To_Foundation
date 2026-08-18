# Factory Runtime watchdog -- restarts server.mjs immediately if it ever
# exits for any reason (crash, EADDRINUSE, uncaught exception). Factory
# Runtime owns the CE Twin's operational lifecycle and has no acceptable
# "down" state -- it previously ran as a bare `node server.mjs` process
# with zero supervision, which is why an earlier crash left it silently
# dead for the rest of a session. This loop is the fix: at most a few
# seconds of downtime, ever, logged every time it happens.
#
# Two recovery layers, matching two distinct real failure modes:
#  1. The main loop below: server.mjs's OWN process exits (crash, port
#     conflict). "Process is gone" is trivially detectable.
#  2. The background health job: server.mjs is still running (port open,
#     process alive) but the real twin has stopped advancing -- a hang,
#     not a crash. "Process exists" is not the same as "twin is healthy."
#     Polls the backend's own real GET /system/ready (already distinguishes
#     bridgeReachable/driverAlive/stateAdvancing/paused -- reused here
#     rather than re-implemented) and force-restarts only when the driver
#     is alive but genuinely not advancing and not deliberately paused.

$logPath = Join-Path $PSScriptRoot "factory_runtime_dev.log"
# Real local backend URL -- must match whatever port backend/.env's own
# PORT is actually running on this session (confirmed 4310 this session;
# see feedback_always_launch_full_stack.md's own note about this drifting).
$backendReadyUrl = "http://localhost:4310/system/ready"
$healthCheckIntervalSec = 15
$hungThresholdChecks = 2

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logPath -Value "[watchdog] $timestamp $Message" -Encoding utf8
}

$healthJob = Start-Job -ScriptBlock {
    param($ReadyUrl, $IntervalSec, $HungThreshold, $LogPath)
    $hungCount = 0
    while ($true) {
        Start-Sleep -Seconds $IntervalSec
        try {
            $resp = Invoke-RestMethod -Uri $ReadyUrl -TimeoutSec 5
            $twin = $resp.twin
            if ($twin.driverAlive -and -not $twin.stateAdvancing -and -not $twin.paused) {
                $hungCount++
                $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                Add-Content -Path $LogPath -Value "[watchdog-health] $ts twin driver alive but not advancing (check $hungCount/$HungThreshold)" -Encoding utf8
                if ($hungCount -ge $HungThreshold) {
                    Add-Content -Path $LogPath -Value "[watchdog-health] $ts twin hung -- forcing a restart" -Encoding utf8
                    $nodePid = (Get-NetTCPConnection -LocalPort 4103 -State Listen -ErrorAction SilentlyContinue).OwningProcess
                    if ($nodePid) { Stop-Process -Id $nodePid -Force -ErrorAction SilentlyContinue }
                    $hungCount = 0
                }
            } else {
                $hungCount = 0
            }
        } catch {
            # Backend itself unreachable -- not this job's concern; if
            # factory-runtime's own process died, the main loop below
            # already handles that independently.
        }
    }
} -ArgumentList $backendReadyUrl, $healthCheckIntervalSec, $hungThresholdChecks, $logPath

Write-Log "health monitor job started (job id $($healthJob.Id)) -- polling $backendReadyUrl every ${healthCheckIntervalSec}s"

while ($true) {
    Write-Log "starting factory-runtime..."

    Push-Location $PSScriptRoot
    # Routed through cmd.exe's own file redirection (not PowerShell's
    # `*>>` pipeline semantics) -- PowerShell 5.1 wraps native stderr
    # lines in a NativeCommandError and mangles encoding when captured via
    # its own redirection operators; cmd.exe's real `>>`/`2>&1` writes the
    # raw bytes straight to the file, keeping the log human-readable.
    & cmd /c "node server.mjs >> `"$logPath`" 2>&1"
    $exitCode = $LASTEXITCODE
    Pop-Location

    Write-Log "factory-runtime exited (code $exitCode) -- restarting in 2s"
    Start-Sleep -Seconds 2
}
