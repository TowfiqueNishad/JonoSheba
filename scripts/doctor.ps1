# Jonoshheba AI — Windows PowerShell Health Dashboard (scripts/doctor.ps1)
$ErrorActionPreference = 'SilentlyContinue'

$script:Pass = 0
$script:Fail = 0

function Test-HttpService {
  param(
    [string]$Name,
    [string]$Url,
    [bool]$Required = $true
  )
  try {
    $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
      Write-Host ("  [OK]   {0,-22} {1}" -f $Name, $Url) -ForegroundColor Green
      $script:Pass++
      return
    }
  } catch {}

  if ($Required) {
    Write-Host ("  [FAIL] {0,-22} {1}" -f $Name, $Url) -ForegroundColor Red
    $script:Fail++
  } else {
    Write-Host ("  [SKIP] {0,-22} {1} (optional)" -f $Name, $Url) -ForegroundColor Yellow
  }
}

function Test-TcpService {
  param(
    [string]$Name,
    [string]$HostName,
    [int]$Port
  )
  $tcp = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $tcp.BeginConnect($HostName, $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(2000, $false) -and $tcp.Connected) {
      $tcp.EndConnect($async)
      Write-Host ("  [OK]   {0,-22} {1}:{2}" -f $Name, $HostName, $Port) -ForegroundColor Green
      $script:Pass++
      return
    }
  } catch {} finally {
    $tcp.Close()
  }
  Write-Host ("  [FAIL] {0,-22} {1}:{2}" -f $Name, $HostName, $Port) -ForegroundColor Red
  $script:Fail++
}

Write-Host "=== Jonoshheba AI Doctor ===" -ForegroundColor Cyan
Write-Host "`nCore Infrastructure:"
Test-TcpService  "PostgreSQL 16"  "127.0.0.1" 5432
Test-TcpService  "Redis 7"        "127.0.0.1" 6379
Test-HttpService "MinIO"          "http://127.0.0.1:9000/minio/health/live"
Test-HttpService "Mailpit"        "http://127.0.0.1:8025/readyz"
Test-HttpService "MLflow"         "http://127.0.0.1:5000/health"
Test-HttpService "Prometheus"     "http://127.0.0.1:9090/-/healthy"
Test-HttpService "Loki"           "http://127.0.0.1:3100/ready"
Test-HttpService "Tempo"          "http://127.0.0.1:3200/ready"
Test-HttpService "Grafana"        "http://127.0.0.1:3005/api/health"
Test-HttpService "OTel Collector" "http://127.0.0.1:13133/"

Write-Host "`nApplications:"
Test-HttpService "apps/api"       "http://127.0.0.1:4000/health"
Test-HttpService "apps/ai"        "http://127.0.0.1:8000/health"
Test-HttpService "apps/web"       "http://127.0.0.1:3000/" $false
Test-HttpService "apps/admin"     "http://127.0.0.1:3001/" $false

Write-Host "`nSummary: $($script:Pass) healthy, $($script:Fail) failed."
if ($script:Fail -gt 0) { exit 1 }
