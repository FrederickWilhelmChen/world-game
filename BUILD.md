# 项目构建指南

在新机器上构建和运行本项目的完整步骤。

## 前置要求

- **操作系统**: Windows 10/11 (64位)
- **磁盘空间**: 至少 2GB 可用空间
- **网络**: 需要联网下载依赖

## 步骤 1: 安装 .NET 8.0 SDK

### 方式 A: 使用安装脚本（推荐）

打开 PowerShell，运行：

```powershell
# 创建安装目录
mkdir C:\tools -Force

# 下载安装脚本
Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile 'C:\tools\dotnet-install.ps1'

# 安装 .NET 8.0 SDK
& C:\tools\dotnet-install.ps1 -Channel 8.0 -InstallDir 'C:\tools\dotnet'

# 添加到环境变量（当前会话）
$env:DOTNET_ROOT = 'C:\tools\dotnet'
$env:PATH = 'C:\tools\dotnet;' + $env:PATH

# 验证安装
dotnet --version
# 应该显示: 8.0.xxx
```

### 方式 B: 手动下载安装

1. 访问 https://dotnet.microsoft.com/download/dotnet/8.0
2. 下载 ".NET SDK" Windows x64 版本
3. 运行安装程序
4. 验证: 打开命令提示符，输入 `dotnet --version`

## 步骤 2: 安装 Godot 4.3 (.NET版本)

### 方式 A: 直接下载（推荐）

1. 访问 https://godotengine.org/download/archive/4.3-stable/
2. 下载 **"Godot Engine - .NET"** Windows 64-bit 版本
3. 解压到 `C:\tools\Godot_v4.3-stable_mono_win64`

或者使用 PowerShell：

```powershell
# 下载
$godotUrl = 'https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_mono_win64.zip'
Invoke-WebRequest -Uri $godotUrl -OutFile 'C:\tools\Godot_v4.3.zip'

# 解压
Expand-Archive -Path 'C:\tools\Godot_v4.3.zip' -DestinationPath 'C:\tools'

# 验证
ls C:\tools\Godot_v4.3-stable_mono_win64
```

### 方式 B: 使用 Scoop（包管理器）

```powershell
# 安装 Scoop（如果还没有）
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# 添加 Godot 仓库
scoop bucket add games

# 安装 Godot 4.3 Mono
scoop install godot-mono
```

## 步骤 3: 获取项目代码

### 方式 A: Git 克隆

```bash
git clone <你的仓库地址> E:\world-game
cd E:\world-game
```

### 方式 B: 直接复制

将项目文件夹复制到 `E:\world-game`（或其他位置）

## 步骤 4: 构建项目

### 方式 A: 使用 .NET CLI

```powershell
# 设置环境变量
$env:DOTNET_ROOT = 'C:\tools\dotnet'
$env:PATH = 'C:\tools\dotnet;' + $env:PATH

# 进入项目目录
cd E:\world-game

# 还原 NuGet 包
dotnet restore

# 构建项目
dotnet build

# 输出应该显示: 生成成功
```

### 方式 B: 使用 Godot 编辑器

1. 运行 Godot：
   ```powershell
   C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe
   ```

2. 在 Godot 项目管理器中：
   - 点击 **"导入项目"**
   - 选择 `E:\world-game\project.godot`
   - 点击 **"打开"**

3. 首次打开时，Godot 会自动：
   - 导入资源
   - 构建 C# 项目
   - 生成 `.godot` 文件夹

4. 点击 **"运行项目"** 或按 **F5**

## 步骤 5: 运行游戏

### 方式 A: 使用启动脚本

项目包含两个启动脚本：

**Batch 版本:**
```batch
E:\world-game\LaunchGame.bat
```

**PowerShell 版本:**
```powershell
E:\world-game\LaunchGame.ps1
```

### 方式 B: 命令行直接运行

```powershell
# 设置环境
$env:DOTNET_ROOT = 'C:\tools\dotnet'
$env:PATH = 'C:\tools\dotnet;' + $env:PATH

# 运行
C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe --path 'E:\world-game'
```

### 方式 C: 从 Godot 编辑器运行

1. 打开 Godot 编辑器
2. 加载项目
3. 按 **F5** 或点击右上角的 **"运行项目"** 按钮

## 常见问题

### 问题 1: "dotnet 不是内部或外部命令"

**解决**: 没有正确设置 PATH 环境变量
```powershell
$env:PATH = 'C:\tools\dotnet;' + $env:PATH
```

### 问题 2: "Cannot instantiate C# script"

**解决**: .NET 项目未构建
```powershell
cd E:\world-game
dotnet build
```

### 问题 3: "Failed to load hostfxr"

**解决**: Godot 找不到 .NET SDK
```powershell
$env:DOTNET_ROOT = 'C:\tools\dotnet'
```

### 问题 4: "项目已存在，但无法加载"

**解决**: 删除 `.godot` 文件夹，让 Godot 重新生成
```powershell
Remove-Item -Recurse -Force E:\world-game\.godot
```

## 完整自动化脚本

创建一个 `setup-and-run.ps1` 文件：

```powershell
# 设置和运行脚本
param(
    [string]$ProjectPath = "E:\world-game",
    [string]$DotNetPath = "C:\tools\dotnet",
    [string]$GodotPath = "C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe"
)

# 设置环境变量
$env:DOTNET_ROOT = $DotNetPath
$env:PATH = "$DotNetPath;$env:PATH"

# 检查 .NET
if (-not (Test-Path "$DotNetPath\dotnet.exe")) {
    Write-Error ".NET SDK 未找到: $DotNetPath"
    exit 1
}

# 检查 Godot
if (-not (Test-Path $GodotPath)) {
    Write-Error "Godot 未找到: $GodotPath"
    exit 1
}

# 进入项目目录
Set-Location $ProjectPath

# 还原和构建
Write-Host "正在还原 NuGet 包..." -ForegroundColor Green
dotnet restore

Write-Host "正在构建项目..." -ForegroundColor Green
dotnet build

if ($LASTEXITCODE -eq 0) {
    Write-Host "构建成功！正在启动游戏..." -ForegroundColor Green
    & $GodotPath --path $ProjectPath
} else {
    Write-Error "构建失败"
    exit 1
}
```

使用方法：
```powershell
.\setup-and-run.ps1
```

## 导出为独立 EXE

如果你想导出为独立的 `.exe` 文件（不需要 Godot 编辑器）：

1. 打开 Godot 编辑器
2. 点击 **"项目" → "导出"**
3. 添加 Windows Desktop 预设
4. 配置导出选项
5. 点击 **"导出项目"**

或者使用命令行：
```powershell
C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe --path 'E:\world-game' --export-release "Windows Desktop" "E:\output\GrandStrategyGame.exe"
```

## 系统要求

| 组件 | 最低要求 | 推荐 |
|------|---------|------|
| **CPU** | x64 处理器 | 多核处理器 |
| **内存** | 4 GB RAM | 8 GB RAM |
| **显卡** | OpenGL 3.3 兼容 | 独立显卡 |
| **存储** | 500 MB | 1 GB SSD |
| **系统** | Windows 10 | Windows 11 |

## 联系支持

遇到问题？请检查：
1. 所有路径是否正确
2. 环境变量是否设置
3. 查看 Godot 控制台输出中的错误信息
4. 查看 `user://logs/godot.log` 日志文件
