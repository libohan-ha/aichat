"use client"

import { useEffect } from "react"

interface KeyboardShortcutsProps {
  onSearch: () => void
  onSettings: () => void
  onSend?: () => void
}

export function KeyboardShortcuts({ onSearch, onSettings, onSend }: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey


      // Ctrl/Cmd + F: 搜索
      if (ctrlKey && event.key === "f") {
        event.preventDefault()
        onSearch()
      }

      // Ctrl/Cmd + ,: 设置
      if (ctrlKey && event.key === ",") {
        event.preventDefault()
        onSettings()
      }

      // Ctrl/Cmd + Enter: 发送消息
      if (ctrlKey && event.key === "Enter" && onSend) {
        event.preventDefault()
        onSend()
      }

      // Escape: 关闭搜索或对话框
      if (event.key === "Escape") {
        // 这里可以添加关闭逻辑
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onSearch, onSettings, onSend])

  return null
}
