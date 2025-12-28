"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
// Replace custom ScrollArea with native scrolling for robustness
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Copy, Plus, RefreshCw } from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  characterId?: string
  imageUrls?: string[]
}

interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  userAvatar?: string
  bubbleUserOpacity?: number
  bubbleAiOpacity?: number
}

interface MessageListProps {
  messages: Message[]
  characters: Character[]
  currentCharacter: Character
  isLoading: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  onNewConversation?: () => void
  onRegenerate?: () => void
}

export function MessageList({
  messages,
  characters,
  currentCharacter,
  isLoading,
  onLoadMore,
  hasMore,
  onNewConversation,
  onRegenerate,
}: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      const isMobile = window.innerWidth < 768
      messagesEndRef.current.scrollIntoView({
        behavior: isMobile ? "auto" : "smooth",
        block: "end",
      })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  const lastMessageKey = useMemo(() => {
    if (messages.length === 0) return ""
    const last = messages[messages.length - 1]
    return `${last.id}-${(last.content || "").length}`
  }, [messages])
  useEffect(() => {
    if (lastMessageKey) scrollToBottom()
  }, [lastMessageKey, scrollToBottom])

  const copyMessage = useCallback(async (content: string) => {
    const fallbackCopy = (text: string) => {
      try {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.top = "-1000px"
        textarea.style.left = "-1000px"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        textarea.setSelectionRange(0, text.length)
        const ok = document.execCommand("copy")
        document.body.removeChild(textarea)
        return ok
      } catch {
        return false
      }
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content)
        toast({ title: "已复制到剪贴板" })
        return
      }
      // Clipboard API 不可用时走降级
      const ok = fallbackCopy(content)
      if (ok) {
        toast({ title: "已复制到剪贴板" })
      } else {
        toast({ title: "复制失败", variant: "destructive" })
      }
    } catch {
      // 某些环境（非安全上下文、移动端 WebView）会失败，尝试降级
      const ok = fallbackCopy(content)
      if (ok) {
        toast({ title: "已复制到剪贴板" })
      } else {
        toast({ title: "复制失败", variant: "destructive" })
      }
    }
  }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-background/95 backdrop-blur-sm">
        <h2 className="font-semibold text-sm sm:text-base truncate"> {currentCharacter?.name || "AI"} </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (onNewConversation) {
                const ok = messages.length > 0 ? window.confirm("开始新对话将清空当前消息，确认继续？") : true
                if (ok) onNewConversation()
              }
            }}
            className="text-xs sm:text-sm bg-transparent"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">新建对话</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 sm:p-4 scrollbar-thin overflow-y-auto" ref={scrollAreaRef}>
        {hasMore && (
          <div className="text-center mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-xs sm:text-sm bg-transparent"
            >
              {isLoading ? "加载中..." : "加载更多消息"}
            </Button>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto">
          {messages.map((message, index) => {
            const character =
              message.sender === "ai" ? characters.find((c) => c.id === message.characterId) || currentCharacter : null

            // 判断是否是最后一条AI消息
            const isLastAiMessage = message.sender === "ai" &&
              index === messages.findLastIndex(m => m.sender === "ai")

            return (
              <div
                key={message.id}
                id={`message-${message.id}`}
                className={`flex gap-2 sm:gap-3 group transition-colors duration-300 ${message.sender === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
                  <AvatarImage
                    src={message.sender === "user" ? currentCharacter?.userAvatar || "/placeholder-user.jpg" : character?.avatar}
                    alt={message.sender === "user" ? "用户" : character?.name || "AI"}
                  />
                  <AvatarFallback className="text-xs sm:text-sm">
                    {message.sender === "user" ? "我" : character?.name?.[0] || "AI"}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex-1 max-w-[85%] sm:max-w-[80%]`}>
                  <div className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`p-2 sm:p-3 rounded-lg relative animate-fade-in text-left ${
                        message.sender === "user" ? "text-primary-foreground" : ""
                      }`}
                      style={{
                        backgroundColor:
                          message.sender === "user"
                            ? `color-mix(in oklch, var(--color-primary) ${Math.round(
                                (currentCharacter?.bubbleUserOpacity ?? 1) * 100,
                              )}%, transparent)`
                            : `color-mix(in oklch, var(--color-muted) ${Math.round(
                                (currentCharacter?.bubbleAiOpacity ?? 1) * 100,
                              )}%, transparent)`,
                        maxWidth: '100%',
                      }}
                    >
                      {message.imageUrls && message.imageUrls.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mb-2 ${message.imageUrls.length === 1 ? '' : ''}`}>
                          {message.imageUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url || "/placeholder.svg"}
                              alt={`上传的图片 ${idx + 1}`}
                              className={`rounded object-cover ${
                                message.imageUrls!.length === 1
                                  ? 'max-w-full max-h-48 sm:max-h-64'
                                  : 'max-w-[45%] max-h-32 sm:max-h-40'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">
                        {message.content || ""}
                      </p>

                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        {isLastAiMessage && onRegenerate && !isLoading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-5 h-5 sm:w-6 sm:h-6 p-0 touch-manipulation focus-visible"
                            onClick={onRegenerate}
                            title="重新生成"
                          >
                            <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-5 h-5 sm:w-6 sm:h-6 p-0 touch-manipulation focus-visible"
                          onClick={() => copyMessage(message.content || "")}
                          title="复制消息"
                        >
                          <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div
                    suppressHydrationWarning
                    className={`text-xs text-muted-foreground mt-1 ${message.sender === "user" ? "text-right" : "text-left"}`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            )
          })}
          {(() => {
            const last = messages[messages.length - 1]
            const showTyping = isLoading && (!last || last.sender !== "ai")
            return showTyping ? (
            <div className="flex gap-2 sm:gap-3 animate-slide-up">
              <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                <AvatarImage
                  src={currentCharacter?.avatar || "/placeholder.svg"}
                  alt={currentCharacter?.name || "AI"}
                />
                <AvatarFallback className="text-xs sm:text-sm">{currentCharacter?.name?.[0] || "AI"}</AvatarFallback>
              </Avatar>
              <div className="bg-muted p-2 sm:p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
            ) : null
          })()}
        </div>

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
