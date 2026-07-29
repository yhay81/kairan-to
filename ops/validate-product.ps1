[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PagesPath = Join-Path $RepoRoot "src\ui\pages.tsx"
$ProductPath = Join-Path $RepoRoot "src\config\product.ts"
$WorkerPath = Join-Path $RepoRoot "src\worker.tsx"
$PublicDirectory = Join-Path $RepoRoot "public"
$Pages = Get-Content -Raw -LiteralPath $PagesPath
$Product = Get-Content -Raw -LiteralPath $ProductPath
$Worker = Get-Content -Raw -LiteralPath $WorkerPath

if ($Pages.Contains('data-template-surface="replace-before-release"')) {
    throw "Replace the starter workspace before release"
}
if ($Pages.Contains('class="hero"') -or $Pages.Contains('class="product-flow"')) {
    throw "Text-led hero and generic product-flow sections are not releaseable"
}
if (-not $Pages.Contains("light-ring") -or -not $Pages.Contains('id="create-form"')) {
    throw "Expected the product-specific circular light visualization and creation workspace"
}
if ($Pages -match '(?i)public validation|success criteria|experiment|仮説|成功条件') {
    throw "Research copy must not appear on the product surface"
}
if (-not $Pages.Contains('id="response-form"') -or -not $Pages.Contains('id="reader-list"')) {
    throw "Expected product-specific response and owner surfaces"
}
if (-not $Pages.Contains('id="read-count"') -or -not $Pages.Contains('id="progress-bar"')) {
    throw "Expected the read-progress visualization"
}
if (-not $Worker.Contains('summary: await getAggregates') -or $Worker.Contains('publicNotice.acknowledgements')) {
    throw "Public notice API must expose aggregates without individual responses"
}
if ($Product.Contains('"noriai-hyo"') -or $Product.Contains('"のりあい表"')) {
    throw "Replace the previous product identity before release"
}

$OgPath = Join-Path $PublicDirectory "og.svg"
if (-not (Test-Path -LiteralPath $OgPath) -or (Get-Item -LiteralPath $OgPath).Length -lt 3000) {
    throw "Expected a product-specific OG SVG larger than 3 KB"
}

$KeyFiles = @(
    Get-ChildItem -LiteralPath $PublicDirectory -File |
        Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" }
)
if ($KeyFiles.Count -ne 1) {
    throw "Expected exactly one generated IndexNow key file, found $($KeyFiles.Count)"
}
$Key = (Get-Content -Raw -LiteralPath $KeyFiles[0].FullName).Trim()
if ($Key -ne $KeyFiles[0].BaseName) {
    throw "IndexNow key file name and content do not match"
}

Write-Output "Product release contract is satisfied"
