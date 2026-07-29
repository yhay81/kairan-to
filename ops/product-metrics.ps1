[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute kairan-to $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Notices = [int]$Row.notices_created
$WithReads = [int]$Row.notices_with_reads

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "kairan-to"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        organizers = [int]$Row.organizers
        notices_created = $Notices
        links_copied = [int]$Row.links_copied
        owner_opened = [int]$Row.owner_opened
        reads_saved = [int]$Row.reads_saved
        respondents = [int]$Row.respondents
        notices_with_reads = $WithReads
        notices_with_ten_reads = [int]$Row.notices_with_ten_reads
        notices_completed = [int]$Row.notices_completed
        attendance_notices = [int]$Row.attendance_notices
        notices_closed = [int]$Row.notices_closed
        repeat_organizers = [int]$Row.repeat_organizers
        returned = [int]$Row.returned
        users_7d = [int]$Row.users_7d
        notices_7d = [int]$Row.notices_7d
    }
    rates = [ordered]@{
        creation_percent = Get-Percent $Notices $Users
        first_read_percent = Get-Percent $WithReads $Notices
        completion_percent = Get-Percent ([int]$Row.notices_completed) $Notices
    }
} | ConvertTo-Json -Depth 4
