.NET 8.0 SDK 和 Godot 4.3 已安装成功！

## 安装位置

| 软件 | 路径 |
|------|------|
| .NET 8.0 SDK | `C:\tools\dotnet` |
| Godot 4.3 .NET | `C:\tools\Godot_v4.3-stable_mono_win64` |

## 如何运行项目

### 方式1：直接双击运行
1. 打开文件资源管理器
2. 进入 `C:\tools\Godot_v4.3-stable_mono_win64`
3. 双击 `Godot_v4.3-stable_mono_win64.exe`
4. 在 Godot 项目管理器中点击"导入项目"
5. 选择 `E:\world-game\project.godot`
6. 点击"运行项目"或按 F5

### 方式2：使用命令行
在 PowerShell 中运行：
```powershell
$env:DOTNET_ROOT = "C:\tools\dotnet"
$env:PATH = "C:\tools\dotnet;$env:PATH"
C:\tools\Godot_v4.3-stable_mono_win64\Godot_v4.3-stable_mono_win64.exe --path E:\world-game
```

### 方式3：使用 Visual Studio Code
1. 安装 VS Code 的 C# 和 Godot 插件
2. 打开项目文件夹 `E:\world-game`
3. 按 F5 运行

## 环境变量设置（可选）

添加到系统环境变量以便全局使用：
```
DOTNET_ROOT = C:\tools\dotnet
Path 添加: C:\tools\dotnet;C:\tools\Godot_v4.3-stable_mono_win64
```

## 常见问题

1. **如果提示缺少 .NET SDK**：确保设置了 `DOTNET_ROOT` 环境变量指向 `C:\tools\dotnet`
2. **如果编译失败**：先运行 `dotnet restore` 恢复 NuGet 包
3. **如果渲染异常**：检查显卡驱动是否支持 OpenGL 3.3+
