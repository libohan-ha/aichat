"use client"

import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

type Role = "user" | "assistant"
interface Message {
  id: string
  content: string
  role: Role
  timestamp: Date
  characterId: string
}

// Allow passing messages that use either `role` or `sender`
interface FlexibleMessage {
  id: string
  content: string
  role?: Role
  sender?: "user" | "ai"
  timestamp: Date
  characterId: string
}

interface MessageSearchProps {
  messages: FlexibleMessage[]
  onMessageSelect: (messageId: string) => void
  isOpen: boolean
  onClose: () => void
}

export function MessageSearch({ messages, onMessageSelect, isOpen, onClose }: MessageSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Message[]>([])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const q = searchQuery.toLowerCase()
    const results = messages
      .map((m) => ({
        id: m.id,
        content: m.content,
        role: (m.role ?? (m.sender === "user" ? "user" : "assistant")) as Role,
        timestamp: m.timestamp,
        characterId: m.characterId,
      }))
      .filter((message) => (message.content ?? "").toLowerCase().includes(q))
      .slice(0, 50) // 限制结果数量

    setSearchResults(results)
  }, [searchQuery, messages])

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text
    const regex = new RegExp(`(${query})`, "gi")
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
      <div className="w-full max-w-2xl mx-4 bg-background border rounded-lg shadow-lg">
        <div className="flex items-center gap-2 p-4 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索消息..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-96">
          {searchResults.length > 0 ? (
            <div className="p-2">
              {searchResults.map((message) => (
                <div
                  key={message.id}
                  className="p-3 hover:bg-muted/50 rounded cursor-pointer border-b last:border-b-0"
                  onClick={() => {
                    onMessageSelect(message.id)
                    onClose()
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        message.role === "user"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      }`}
                    >
                      {message.role === "user" ? "用户" : "AI"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2">{highlightText(message.content || "", searchQuery)}</p>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>未找到匹配的消息</p>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>输入关键词搜索消息</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
