# 一键构建和运行脚本
param(
    [string]$ProjectPath = $PSScriptRoot,
    [string]$DotNetPath = "C:\tools\dotnet",
    [string]$GodotPath = "C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe"
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Grand Strategy Game - 构建脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 .NET
if (-not (Test-Path "$DotNetPath\dotnet.exe")) {
    Write-Error ".NET SDK 未找到: $DotNetPath"
    Write-Host "请安装 .NET 8.0 SDK 到 C:\tools\dotnet" -ForegroundColor Yellow
    Write-Host "查看 BUILD.md 获取详细安装说明" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ .NET SDK 已找到" -ForegroundColor Green

# 检查 Godot
if (-not (Test-Path $GodotPath)) {
    Write-Error "Godot 未找到: $GodotPath"
    Write-Host "请安装 Godot 4.3 (.NET版本) 到 C:\tools\Godot_v4.3-stable_mono_win64" -ForegroundColor Yellow
    Write-Host "查看 BUILD.md 获取详细安装说明" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Godot 已找到" -ForegroundColor Green
Write-Host ""

# 设置环境变量
$env:DOTNET_ROOT = $DotNetPath
$env:PATH = "$DotNetPath;$env:PATH"

# 进入项目目录
Set-Location $ProjectPath
Write-Host "项目路径: $ProjectPath" -ForegroundColor Gray
Write-Host ""

# 还原 NuGet 包
Write-Host "正在还原 NuGet 包..." -ForegroundColor Yellow
dotnet restore
if ($LASTEXITCODE -ne 0) {
    Write-Error "NuGet 包还原失败"
    exit 1
}
Write-Host "✓ NuGet 包还原成功" -ForegroundColor Green
Write-Host ""

# 构建项目
Write-Host "正在构建项目..." -ForegroundColor Yellow
dotnet build
if ($LASTEXITCODE -ne 0) {
    Write-Error "项目构建失败"
    exit 1
}
Write-Host "✓ 项目构建成功" -ForegroundColor Green
Write-Host ""

# 运行游戏
Write-Host "正在启动游戏..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
& $GodotPath --path $ProjectPath
