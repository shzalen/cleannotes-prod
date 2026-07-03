!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

# ---------- App info ----------
!define PRODUCT_NAME "清记"
!define PRODUCT_NAME_EN "CleanNotes"
!define PRODUCT_VERSION "0.1.0"
!define PRODUCT_PUBLISHER "CleanNotes"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME_EN}"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME_EN}"

# ---------- Installer settings ----------
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\dist-app\清记_${PRODUCT_VERSION}_x64-setup.exe"
InstallDir "$LOCALAPPDATA\${PRODUCT_NAME_EN}"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" "InstallDir"
RequestExecutionLevel user
Unicode true
SetCompressor /SOLID lzma

# ---------- MUI Settings ----------
!define MUI_ABORTWARNING
!define MUI_ICON "..\dist-app\清记.ico"
!define MUI_UNICON "..\dist-app\清记.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

# ---------- Version Info ----------
VIProductVersion "0.1.0.0"
VIAddVersionKey /LANG=${LANG_SIMPCHINESE} "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=${LANG_SIMPCHINESE} "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=${LANG_SIMPCHINESE} "FileDescription" "${PRODUCT_NAME} 安装程序"
VIAddVersionKey /LANG=${LANG_SIMPCHINESE} "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${PRODUCT_NAME} Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${PRODUCT_VERSION}"

# ---------- Install Section ----------
Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on

  # Copy Python launcher
  File "..\launcher.py"

  # Copy VBS launcher (no console window)
  File "..\清记.vbs"

  # Copy icon
  File "..\dist-app\清记.ico"

  # Copy web assets
  SetOutPath "$INSTDIR\web"
  File /r "..\dist\*.*"

  # Create desktop shortcut (using VBS launcher for no console)
  CreateShortCut "$DESKTOP\清记.lnk" "wscript.exe" '"$INSTDIR\清记.vbs"' "$INSTDIR\清记.ico" 0 SW_SHOWNORMAL

  # Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\清记.lnk" "wscript.exe" '"$INSTDIR\清记.vbs"' "$INSTDIR\清记.ico" 0 SW_SHOWNORMAL
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\卸载.lnk" "$INSTDIR\uninst.exe"
SectionEnd

Section -AdditionalIcons
  WriteIniStr "$INSTDIR\${PRODUCT_NAME_EN}.url" "InternetShortcut" "URL" "https://github.com/cleannotes"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "DisplayIcon" "$INSTDIR\清记.ico"
  WriteRegDWORD HKCU "${PRODUCT_DIR_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${PRODUCT_DIR_REGKEY}" "NoRepair" 1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${PRODUCT_DIR_REGKEY}" "EstimatedSize" "$0"
SectionEnd

# ---------- Uninstall Section ----------
Section Uninstall
  Delete "$INSTDIR\launcher.py"
  Delete "$INSTDIR\清记.vbs"
  Delete "$INSTDIR\清记.ico"
  Delete "$INSTDIR\${PRODUCT_NAME_EN}.url"
  Delete "$INSTDIR\uninst.exe"
  RMDir /r "$INSTDIR\web"

  Delete "$DESKTOP\清记.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\清记.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\卸载.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
SectionEnd
