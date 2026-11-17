# DualSurf Memory Optimization Script
# Safely flushes working sets for Electron, Node, and DualSurf worker processes

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         DualSurf Memory Optimization Routine           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Define native Windows EmptyWorkingSet method
$MethodDefinition = @'
[DllImport("psapi.dll")]
public static extern int EmptyWorkingSet(IntPtr hwProc);
'@
$Psapi = Add-Type -MemberDefinition $MethodDefinition -Name "PsapiMem" -Namespace "Win32" -PassThru -ErrorAction SilentlyContinue

$targetNames = @("electron", "node", "DualSurf")
$processes = Get-Process | Where-Object { $targetNames -contains $_.ProcessName }

$initialMemMB = 0
$processes | ForEach-Object { $initialMemMB += [math]::Round($_.WorkingSet64 / 1MB, 2) }

Write-Host "Found $($processes.Count) active runtime processes."
Write-Host "Initial Working Set: $initialMemMB MB" -ForegroundColor Yellow

$freedCount = 0
foreach ($proc in $processes) {
    try {
        if (-not $proc.HasExited) {
            [Win32.PsapiMem]::EmptyWorkingSet($proc.Handle) | Out-Null
            $freedCount++
        }
    } catch {
        # Process may have exited or insufficient privilege, ignore
    }
}

# Run .NET GC
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Start-Sleep -Milliseconds 250

$finalMemMB = 0
Get-Process | Where-Object { $targetNames -contains $_.ProcessName } | ForEach-Object {
    $finalMemMB += [math]::Round($_.WorkingSet64 / 1MB, 2)
}

$savingsMB = [math]::Round($initialMemMB - $finalMemMB, 2)
Write-Host "Trimmed Working Set: $finalMemMB MB" -ForegroundColor Green
Write-Host "Memory Reclaimed:    $savingsMB MB across $freedCount processes." -ForegroundColor Cyan
Write-Host "Optimization Complete." -ForegroundColor Green
