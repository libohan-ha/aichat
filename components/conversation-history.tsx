"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, Clock, Pencil, Plus, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface Conversation {
  id: string
  userId: string
  characterId: string
  title: string
  messageCount?: number
  createdAt: string
  updatedAt: string
}

interface ConversationHistoryProps {
  conversations: Conversation[]
  currentConversationId: string | null
  isOpen: boolean
  onClose: () => void
  onNewConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  onUpdateConversationTitle: (conversationId: string, title: string) => Promise<boolean>
}

export function ConversationHistory({
  conversations,
  currentConversationId,
  isOpen,
  onClose,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversationTitle,
}: ConversationHistoryProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // 当开始编辑时，聚焦输入框
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) {
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    }
    return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
  }

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    setConversationToDelete(conversationId)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete)
    }
    setDeleteDialogOpen(false)
    setConversationToDelete(null)
  }

  const handleEditClick = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation()
    setEditingId(conversation.id)
    setEditingTitle(conversation.title)
  }

  const handleSaveTitle = async (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (editingId && editingTitle.trim()) {
      const success = await onUpdateConversationTitle(editingId, editingTitle.trim())
      if (success) {
        setEditingId(null)
        setEditingTitle("")
      }
    }
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
    setEditingTitle("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSaveTitle(e as unknown as React.MouseEvent)
    } else if (e.key === "Escape") {
      setEditingId(null)
      setEditingTitle("")
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div
        className={`fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-background border-r shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            历史对话
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 新建对话按钮 */}
        <div className="p-4">
          <Button
            onClick={() => {
              onNewConversation()
              onClose()
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建对话
          </Button>
        </div>

        {/* 对话列表 */}
        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                暂无历史对话
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => {
                    if (editingId !== conversation.id) {
                      onSelectConversation(conversation.id)
                      onClose()
                    }
                  }}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversationId === conversation.id
                      ? "bg-purple-100 dark:bg-purple-900/30 border-l-4 border-purple-500"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingId === conversation.id ? (
                        <form onSubmit={handleSaveTitle} className="flex items-center gap-1">
                          <Input
                            ref={inputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 text-sm"
                            placeholder="输入对话名称"
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            onClick={handleSaveTitle}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </form>
                      ) : (
                        <h3 className="font-medium truncate">{conversation.title}</h3>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>{formatTime(conversation.updatedAt)}</span>
                        {conversation.messageCount !== undefined && conversation.messageCount > 0 && (
                          <span className="text-purple-500">
                            {conversation.messageCount} 条消息
                          </span>
                        )}
                      </div>
                    </div>
                    {editingId !== conversation.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleEditClick(e, conversation)}
                          title="编辑名称"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteClick(e, conversation.id)}
                          title="删除对话"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除对话？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复此对话的所有消息记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}