# Factory Runtime watchdog -- restarts server.mjs immediately if it ever
# exits for any reason (crash, EADDRINUSE, uncaught exception). Factory
# Runtime owns the CE Twin's operational lifecycle and has no acceptable
# "down" state -- it previously ran as a bare `node server.mjs` process
# with zero supervision, which is why an earlier crash left it silently
# dead for the rest of a session. This loop is the fix: at most a few
# seconds of downtime, ever, logged every time it happens.

$logPath = Join-Path $PSScriptRoot "factory_runtime_dev.log"

while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logPath -Value "[watchdog] $timestamp starting factory-runtime..."

    Push-Location $PSScriptRoot
    # Routed through cmd.exe's own file redirection (not PowerShell's
    # `*>>` pipeline semantics) -- PowerShell 5.1 wraps native stderr
    # lines in a NativeCommandError and mangles encoding when captured via
    # its own redirection operators; cmd.exe's real `>>`/`2>&1` writes the
    # raw bytes straight to the file, keeping the log human-readable.
    & cmd /c "node server.mjs >> `"$logPath`" 2>&1"
    $exitCode = $LASTEXITCODE
    Pop-Location

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logPath -Value "[watchdog] $timestamp factory-runtime exited (code $exitCode) -- restarting in 2s"
    Start-Sleep -Seconds 2
}
