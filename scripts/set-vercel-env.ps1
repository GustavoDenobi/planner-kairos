param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [Parameter(Mandatory = $true)]
  [string]$Value,
  [string]$Environment = 'production'
)

$ErrorActionPreference = 'Stop'

vercel env rm $Name $Environment --yes 2>$null | Out-Null

$process = Start-Process -FilePath 'vercel' -ArgumentList @('env', 'add', $Name, $Environment) -NoNewWindow -PassThru -RedirectStandardInput -Wait
$process.StandardInput.Write($Value)
$process.StandardInput.Close()

if ($process.ExitCode -ne 0) {
  throw "vercel env add failed for $Name (exit $($process.ExitCode))"
}

Write-Host "Set $Name for $Environment"
