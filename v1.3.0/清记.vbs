Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取脚本所在目录
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcherPath = scriptDir & "\launcher.py"

' 优先使用 managed Python（已安装 pywebview）
pythonPath = "C:\Users\alen.liu.ZURU\.workbuddy\binaries\python\versions\3.13.12\pythonw.exe"

If Not fso.FileExists(pythonPath) Then
    ' 回退到系统 pythonw
    pythonPath = "pythonw.exe"
End If

' 无窗口启动
WshShell.Run """" & pythonPath & """ """ & launcherPath & """", 0, False
