"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "@/hooks/use-toast"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  characterId?: string
  imageUrl?: string
}

interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  model?: string
}

interface UseChatOptions {
  userId: string
  onError?: (error: Error) => void
}

export function useChat({ userId, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string, character: Character, imageUrl?: string) => {
      if (!content.trim() && !imageUrl) return
      if (isLoading) return

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        // 添加用户消息
        const userMessage: Message = {
          id: Date.now().toString(),
          content: content.trim(),
          sender: "user",
          timestamp: new Date(),
          characterId: character.id,
          imageUrl,
        }

        setMessages((prev) => [...prev, userMessage])
        setIsLoading(true)

        // 保存用户消息到数据库
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: userMessage.content,
            role: "user",
            characterId: character.id,
            userId,
            image: imageUrl,
          }),
          signal: abortController.signal,
        })

        // 准备AI消息
        const aiMessageId = (Date.now() + 1).toString()
        const tempAiMessage: Message = {
          id: aiMessageId,
          content: "",
          sender: "ai",
          timestamp: new Date(),
          characterId: character.id,
        }

        setMessages((prev) => [...prev, tempAiMessage])

        // 调用AI API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messages.concat(userMessage).map((msg) => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.content,
            })),
            character,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`API调用失败: ${response.status}`)
        }

        // 处理流式响应（健壮的 SSE 解析，避免跨分片丢行）
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ""
        let buffer = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // 事件以空行分隔（`\n\n`）
            let sepIndex
            while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
              const eventBlock = buffer.slice(0, sepIndex)
              buffer = buffer.slice(sepIndex + 2)

              const eventLines = eventBlock.split("\n")
              for (const l of eventLines) {
                const line = l.trim()
                if (line.startsWith("data: ")) {
                  const payload = line.slice(6)
                  try {
                    const data = JSON.parse(payload)
                    if (data?.content) {
                      accumulatedContent += data.content
                      setMessages((prev) =>
                        prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg)),
                      )
                    }
                  } catch {
                    // 忽略解析错误（例如心跳或非 JSON 数据）
                  }
                }
              }
            }
          }

          // 处理任何残留缓冲区（可能没有以空行结尾）
          if (buffer.trim().length) {
            const eventLines = buffer.split("\n")
            for (const l of eventLines) {
              const line = l.trim()
              if (line.startsWith("data: ")) {
                const payload = line.slice(6)
                try {
                  const data = JSON.parse(payload)
                  if (data?.content) {
                    accumulatedContent += data.content
                    setMessages((prev) =>
                      prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg)),
                    )
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        }

        // 保存AI回复到数据库
        if (accumulatedContent) {
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: accumulatedContent,
              role: "assistant",
              characterId: character.id,
              userId,
            }),
            signal: abortController.signal,
          })
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return // 请求被取消，不显示错误
        }

        console.error("发送消息失败:", error)

        // 移除临时的AI消息，添加错误消息
        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.sender !== "ai" || msg.content !== "")
          return [
            ...filtered,
            {
              id: Date.now().toString(),
              content: "抱歉，发送消息时出现错误。请检查网络连接或稍后重试。",
              sender: "ai",
              timestamp: new Date(),
              characterId: character.id,
            },
          ]
        })

        toast({
          title: "发送失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        })

        onError?.(error instanceof Error ? error : new Error("发送消息失败"))
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [messages, isLoading, userId, onError],
  )

  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }, [])

  const loadMessages = useCallback(
    async (characterId: string) => {
      try {
        const response = await fetch(`/api/messages?userId=${userId}&characterId=${characterId}`)
        const result = await response.json()

        if (result.success) {
          const messagesData = result.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.role === "user" ? "user" : "ai",
            timestamp: new Date(msg.timestamp),
            characterId: msg.characterId,
            imageUrl: msg.image,
          }))
          setMessages(messagesData)
        }
      } catch (error) {
        console.error("加载消息失败:", error)
        toast({
          title: "加载失败",
          description: "无法加载历史消息",
          variant: "destructive",
        })
      }
    },
    [userId],
  )

  const clearConversation = useCallback(
    async (characterId: string) => {
      try {
        await fetch(`/api/messages?userId=${userId}&characterId=${characterId}`, { method: "DELETE" })
        setMessages([])
      } catch (error) {
        console.error("清空对话失败:", error)
        toast({ title: "清空失败", variant: "destructive" })
      }
    },
    [userId],
  )

  return {
    messages,
    isLoading,
    sendMessage,
    cancelCurrentRequest,
    loadMessages,
    setMessages,
    clearConversation,
  }
}
