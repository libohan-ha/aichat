"use client"

import { toast } from "@/hooks/use-toast"
import { useCallback, useRef, useState } from "react"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  characterId?: string
  conversationId?: string
  imageUrls?: string[]
}

interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  model?: string
}

interface Conversation {
  id: string
  userId: string
  characterId: string
  title: string
  messageCount?: number
  createdAt: string
  updatedAt: string
}

interface UseChatOptions {
  userId: string
  onError?: (error: Error) => void
}

export function useChat({ userId, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string, character: Character, imageUrls?: string[], conversationId?: string) => {
      if (!content.trim() && (!imageUrls || imageUrls.length === 0)) return
      if (isLoading) return

      const activeConversationId = conversationId || currentConversationId

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
          conversationId: activeConversationId || undefined,
          imageUrls,
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
            conversationId: activeConversationId,
            userId,
            images: imageUrls,
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

        // 调用AI API - 只给最新消息传递图片，历史消息不传图片
        const allMessages = messages.concat(userMessage)
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages.map((msg, index) => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.content,
              // 只有最后一条消息才传递图片
              imageUrls: index === allMessages.length - 1 ? msg.imageUrls : undefined,
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
              conversationId: activeConversationId,
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
    [messages, isLoading, userId, currentConversationId, onError],
  )

  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }, [])

  // 加载对话列表
  const loadConversations = useCallback(
    async (characterId: string) => {
      try {
        const response = await fetch(`/api/conversations?userId=${userId}&characterId=${characterId}`)
        const result = await response.json()

        if (result.success) {
          setConversations(result.conversations)
          return result.conversations as Conversation[]
        }
        return []
      } catch (error) {
        console.error("加载对话列表失败:", error)
        return []
      }
    },
    [userId],
  )

  // 创建新对话
  const createConversation = useCallback(
    async (characterId: string, title = "新对话") => {
      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId, userId, title }),
        })
        const result = await response.json()

        if (result.success) {
          const newConversation = result.conversation as Conversation
          setConversations((prev) => [newConversation, ...prev])
          setCurrentConversationId(newConversation.id)
          setMessages([])
          return newConversation
        }
        return null
      } catch (error) {
        console.error("创建对话失败:", error)
        toast({ title: "创建对话失败", variant: "destructive" })
        return null
      }
    },
    [userId],
  )

  // 更新对话标题
  const updateConversationTitle = useCallback(
    async (conversationId: string, title: string) => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        })

        if (response.ok) {
          const result = await response.json()
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, title: result.conversation.title } : c
            )
          )
          return true
        }
        return false
      } catch (error) {
        console.error("更新对话标题失败:", error)
        toast({ title: "更新失败", variant: "destructive" })
        return false
      }
    },
    [],
  )

  // 删除对话
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== conversationId))
          if (currentConversationId === conversationId) {
            setCurrentConversationId(null)
            setMessages([])
          }
          return true
        }
        return false
      } catch (error) {
        console.error("删除对话失败:", error)
        toast({ title: "删除对话失败", variant: "destructive" })
        return false
      }
    },
    [currentConversationId],
  )

  // 切换对话
  const switchConversation = useCallback(
    async (conversationId: string | null, characterId: string) => {
      setCurrentConversationId(conversationId)
      if (conversationId) {
        // 加载指定对话的消息
        try {
          const response = await fetch(
            `/api/messages?userId=${userId}&characterId=${characterId}&conversationId=${conversationId}`
          )
          const result = await response.json()

          if (result.success) {
            const messagesData = result.messages.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              sender: msg.role === "user" ? "user" : "ai",
              timestamp: new Date(msg.timestamp),
              characterId: msg.characterId,
              conversationId: msg.conversationId,
              imageUrls: msg.images,
            }))
            setMessages(messagesData)
          }
        } catch (error) {
          console.error("加载对话消息失败:", error)
          toast({
            title: "加载失败",
            description: "无法加载对话消息",
            variant: "destructive",
          })
        }
      } else {
        setMessages([])
      }
    },
    [userId],
  )

  const loadMessages = useCallback(
    async (characterId: string, conversationId?: string) => {
      try {
        let url = `/api/messages?userId=${userId}&characterId=${characterId}`
        if (conversationId) {
          url += `&conversationId=${conversationId}`
        }
        const response = await fetch(url)
        const result = await response.json()

        if (result.success) {
          const messagesData = result.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.role === "user" ? "user" : "ai",
            timestamp: new Date(msg.timestamp),
            characterId: msg.characterId,
            conversationId: msg.conversationId,
            imageUrls: msg.images,
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

  // 新建对话（清空当前对话并创建新对话）
  const startNewConversation = useCallback(
    async (characterId: string) => {
      const newConversation = await createConversation(characterId)
      return newConversation
    },
    [createConversation],
  )

  // 兼容旧的 clearConversation（改为新建对话）
  const clearConversation = useCallback(
    async (characterId: string) => {
      await startNewConversation(characterId)
    },
    [startNewConversation],
  )

  // 重新生成最后一条AI回复
  const regenerateLastMessage = useCallback(
    async (character: Character) => {
      if (isLoading) return

      // 找到最后一条AI消息
      const lastAiMessageIndex = messages.findLastIndex(msg => msg.sender === "ai")
      if (lastAiMessageIndex === -1) {
        toast({ title: "没有可重新生成的回复", variant: "destructive" })
        return
      }

      // 找到这条AI消息之前的最后一条用户消息
      const lastUserMessageIndex = messages.slice(0, lastAiMessageIndex).findLastIndex(msg => msg.sender === "user")
      if (lastUserMessageIndex === -1) {
        toast({ title: "找不到对应的用户消息", variant: "destructive" })
        return
      }

      const lastUserMessage = messages[lastUserMessageIndex]
      const lastAiMessage = messages[lastAiMessageIndex]

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        setIsLoading(true)

        // 删除数据库中的旧AI回复
        await fetch(`/api/messages/${lastAiMessage.id}`, {
          method: "DELETE",
          signal: abortController.signal,
        })

        // 清空当前AI消息内容，准备重新生成
        setMessages(prev =>
          prev.map(msg =>
            msg.id === lastAiMessage.id ? { ...msg, content: "" } : msg
          )
        )

        // 准备历史消息（不包含被删除的AI回复）
        const historyMessages = messages.slice(0, lastAiMessageIndex)

        // 调用AI API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyMessages.map((msg, index) => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.content,
              imageUrls: index === historyMessages.length - 1 ? msg.imageUrls : undefined,
            })),
            character,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`API调用失败: ${response.status}`)
        }

        // 处理流式响应
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ""
        let buffer = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

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
                      setMessages(prev =>
                        prev.map(msg => (msg.id === lastAiMessage.id ? { ...msg, content: accumulatedContent } : msg)),
                      )
                    }
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            }
          }

          // 处理残留缓冲区
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
                    setMessages(prev =>
                      prev.map(msg => (msg.id === lastAiMessage.id ? { ...msg, content: accumulatedContent } : msg)),
                    )
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        }

        // 保存新的AI回复到数据库
        if (accumulatedContent) {
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: accumulatedContent,
              role: "assistant",
              characterId: character.id,
              conversationId: currentConversationId,
              userId,
            }),
            signal: abortController.signal,
          })
        }

        toast({ title: "重新生成完成" })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        console.error("重新生成失败:", error)
        toast({
          title: "重新生成失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        })

        onError?.(error instanceof Error ? error : new Error("重新生成失败"))
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [messages, isLoading, userId, currentConversationId, onError],
  )

  return {
    messages,
    isLoading,
    conversations,
    currentConversationId,
    sendMessage,
    cancelCurrentRequest,
    loadMessages,
    setMessages,
    clearConversation,
    regenerateLastMessage,
    // 新增对话管理方法
    loadConversations,
    createConversation,
    updateConversationTitle,
    deleteConversation,
    switchConversation,
    startNewConversation,
    setCurrentConversationId,
  }
}
