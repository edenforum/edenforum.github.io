<#
.SYNOPSIS
    Build and deploy edenforum to Cloudflare Pages.

.DESCRIPTION
    Builds the static site (npm run build) and uploads the build/ folder to
    Cloudflare Pages using wrangler. The first time you run it, wrangler will
    open a browser to log in to your Cloudflare account.

.PARAMETER Project
    Cloudflare Pages project name. Defaults to "edenforum".

.PARAMETER Branch
    Branch to deploy to. Use "main" (or your production branch) for the live
    site; anything else creates a preview deployment. Defaults to "main".

.PARAMETER Preview
    Skip deploying; just build and serve the production build locally so you
    can check it before pushing it live.

.EXAMPLE
    ./deploy.ps1
    Build and deploy to production.

.EXAMPLE
    ./deploy.ps1 -Branch staging
    Build and deploy a preview under the "staging" branch.

.EXAMPLE
    ./deploy.ps1 -Preview
    Build and preview locally only.
#>
param(
    [string]$Project = "edenforum",
    [string]$Branch = "main",
    [switch]$Preview
)

$ErrorActionPreference = "Stop"

# Run from the script's own directory regardless of where it's invoked.
Set-Location -Path $PSScriptRoot

# Ensure dependencies are installed.
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
}

# Build the static site.
Write-Host "Building site..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

if ($Preview) {
    Write-Host "Starting local preview of the production build..." -ForegroundColor Green
    npm run preview
    return
}

# Deploy to Cloudflare Pages. First run triggers a browser login.
Write-Host "Deploying to Cloudflare Pages (project: $Project, branch: $Branch)..." -ForegroundColor Cyan
npx wrangler pages deploy build --project-name=$Project --branch=$Branch
if ($LASTEXITCODE -ne 0) { throw "Deploy failed." }

Write-Host "Done." -ForegroundColor Green
