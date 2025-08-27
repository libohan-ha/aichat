"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Sparkles, Loader2 } from "lucide-react"

interface MessageInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
  placeholder?: string
  onAiCompose?: () => Promise<string>
  aiComposing?: boolean
}

export function MessageInput({ onSendMessage, disabled, placeholder = "输入消息...", onAiCompose, aiComposing }: MessageInputProps) {
  const [message, setMessage] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // 自动聚焦到输入框
  useEffect(() => {
    if (textareaRef.current && !disabled && !isMobile) {
      textareaRef.current.focus()
    }
  }, [disabled, isMobile])

  // 页面加载完成后聚焦
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current && !disabled && !isMobile) {
        textareaRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // 全局点击处理，确保输入框保持聚焦
  useEffect(() => {
    if (isMobile || disabled) return

    const handleGlobalClick = (e: Event) => {
      // 如果点击的不是可交互元素，就重新聚焦到输入框
      const target = e.target as HTMLElement
      const isInteractive = target.tagName === 'BUTTON' || 
                           target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.tagName === 'A' ||
                           target.closest('button') ||
                           target.closest('a') ||
                           target.closest('[role="button"]') ||
                           target.closest('[role="menuitem"]')
      
      if (!isInteractive && textareaRef.current && document.activeElement !== textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 10)
      }
    }

    document.addEventListener('click', handleGlobalClick, true)
    return () => document.removeEventListener('click', handleGlobalClick, true)
  }, [isMobile, disabled])

  useEffect(() => {
    if (!isMobile || !textareaRef.current) return

    const textarea = textareaRef.current
    const initialViewportHeight = window.visualViewport?.height || window.innerHeight

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height
        const heightDiff = initialViewportHeight - currentHeight

        // 键盘弹出时，确保输入框可见
        if (heightDiff > 100) {
          setTimeout(() => {
            textarea.scrollIntoView({ behavior: "smooth", block: "center" })
          }, 100)
        }
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange)
      return () => {
        window.visualViewport?.removeEventListener("resize", handleViewportChange)
      }
    }
  }, [isMobile])

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return

    onSendMessage(message.trim())
    setMessage("")

    // 重置textarea高度并重新聚焦
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      if (isMobile) {
        textareaRef.current.blur()
      } else {
        // 桌面端发送后重新聚焦
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 50)
      }
    }
  }, [message, disabled, onSendMessage, isMobile])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey
        if (isCtrlOrCmd) {
          // Ctrl/Cmd + Enter: 发送
          e.preventDefault()
          handleSend()
          return
        }

        if (isMobile) {
          // 移动端：Enter键换行，需要点击发送按钮发送
          return
        }

        // 桌面端默认：Enter 发送，Shift+Enter 换行
        if (!e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
      }
    },
    [handleSend, isMobile],
  )

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value)

      // 自动调整高度
      const textarea = e.target
      textarea.style.height = "auto"
      const newHeight = Math.min(textarea.scrollHeight, isMobile ? 100 : 120)
      textarea.style.height = newHeight + "px"
    },
    [isMobile],
  )

  const handleAiCompose = useCallback(async () => {
    if (!onAiCompose || disabled) return
    try {
      const draft = await onAiCompose()
      if (draft && draft.trim()) {
        setMessage(draft)
        if (textareaRef.current) {
          const ta = textareaRef.current
          ta.style.height = "auto"
          ta.style.height = Math.min(ta.scrollHeight, isMobile ? 100 : 120) + "px"
        }
      }
    } catch (e) {
      // 忽略，父级会 toast
    }
  }, [onAiCompose, disabled, isMobile])


  return (
    <div
      className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur-sm p-3 sm:p-4"
      style={{
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : undefined,
      }}
    >

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={`resize-none ${
              isMobile ? "min-h-[40px] max-h-[100px] text-base" : "min-h-[44px] max-h-[120px]"
            }`}
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck="true"
          />
        </div>

        <div className="flex gap-1">
          {onAiCompose && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiCompose}
              disabled={disabled || aiComposing}
              className={`p-0 touch-manipulation ${isMobile ? "w-9 h-9" : "w-10 h-10"}`}
              title="AI帮回（Gemini）：生成草稿"
            >
              {aiComposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            size="sm"
            className={`p-0 touch-manipulation ${isMobile ? "w-9 h-9" : "w-10 h-10"}`}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isMobile && (
        <div className="text-xs text-muted-foreground mt-2 text-center">
          {message.trim() ? "点击发送按钮发送消息" : "输入消息"}
        </div>
      )}
    </div>
  )
}
