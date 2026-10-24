# RouteX — Fast Health Probe
# Returns exit code 0 if RouteX is online on port 8000, 1 otherwise.

$ErrorActionPreference = "SilentlyContinue"

try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -TimeoutSec 1 -ErrorAction Stop
    if ($res.status -eq "ONLINE" -and $res.system -like "*RouteX*") {
        exit 0
    }
    exit 1
} catch {
    exit 1
}
