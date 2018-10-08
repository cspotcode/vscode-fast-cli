#NoTrayIcon
titleRegexp := A_Args[1]

; Iterate all Code.exe windows
WinGet, winIds, List, ahk_exe Code.exe
SetTitleMatchMode, RegEx
loop % winIds
{
    winId := % winIds%A_Index%
    WinGetTitle, winTitle, ahk_id %winId%
    MatchPos := RegExMatch(winTitle, titleRegexp)
    if MatchPos > 0
    {
        WinShow, ahk_id %winid%
        WinActivate, ahk_id %winid%
        Exit
    }
}

; bring-to-front.ahk - vscode-fast-cli - Visual Studio Code
; ahk_class Chrome_WidgetWin_1
; ahk_exe Code.exe

; DetectHiddenWindows, On