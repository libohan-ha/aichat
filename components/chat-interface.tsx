"use client"
import { BackgroundSettings } from "@/components/background-settings"
import { CharacterDialog } from "@/components/character-dialog"
import { CharacterSidebar } from "@/components/character-sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { MessageInput } from "@/components/message-input"
import { MessageList } from "@/components/message-list"
import { MessageSearch } from "@/components/message-search"
import { ThemeToggle } from "@/components/theme-toggle"
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
import { useChat } from "@/hooks/use-chat"
import { toast } from "@/hooks/use-toast"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  background?: string
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  userAvatar?: string
  bubbleUserOpacity?: number
  bubbleAiOpacity?: number
  model?: string
}

export function ChatInterface() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const [characterDialogOpen, setCharacterDialogOpen] = useState(false)
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [characterToDelete, setCharacterToDelete] = useState<Character | undefined>()
  const [chatBackground, setChatBackground] = useState("")
  const [defaultBackground, setDefaultBackground] = useState("")

  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])

  const userId = "default" // 暂时使用默认用户ID

  const { messages, isLoading, sendMessage, cancelCurrentRequest, loadMessages, clearConversation, regenerateLastMessage } = useChat({
    userId,
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        const visualViewport = window.visualViewport
        if (visualViewport) {
          const keyboardHeight = window.innerHeight - visualViewport.height
          setKeyboardHeight(keyboardHeight > 0 ? keyboardHeight : 0)
        }
      }
    }

    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize)
      return () => {
        window.visualViewport?.removeEventListener("resize", handleResize)
      }
    }
  }, [])

  useEffect(() => {
    let startX = 0
    let currentX = 0
    let isDragging = false

    const handleTouchStart = (e: TouchEvent) => {
      if (sidebarOpen && e.touches.length === 1) {
        startX = e.touches[0].clientX
        isDragging = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !sidebarOpen) return
      currentX = e.touches[0].clientX
      const deltaX = currentX - startX

      if (deltaX < -100) {
        setSidebarOpen(false)
        isDragging = false
      }
    }

    const handleTouchEnd = () => {
      isDragging = false
    }

    if (sidebarOpen) {
      document.addEventListener("touchstart", handleTouchStart, { passive: true })
      document.addEventListener("touchmove", handleTouchMove, { passive: true })
      document.addEventListener("touchend", handleTouchEnd, { passive: true })
    }

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [sidebarOpen])

  const loadCharacters = useCallback(async () => {
    try {
      const response = await fetch(`/api/characters?userId=${userId}`)
      const result = await response.json()

      if (result.success) {
        const charactersData = result.characters.map((char: any) => ({
          id: char.id,
          name: char.name,
          avatar: char.avatar,
          prompt: char.prompt,
          background: char.background,
          backgroundSize: char.backgroundSize,
          backgroundPosition: char.backgroundPosition,
          backgroundRepeat: char.backgroundRepeat,
          userAvatar: char.userAvatar,
          bubbleUserOpacity: char.bubbleUserOpacity,
          bubbleAiOpacity: char.bubbleAiOpacity,
          model: char.model,
        }))

        setCharacters(charactersData)

        // 优先从 URL 参数恢复角色选择
        if (!currentCharacter && charactersData.length > 0) {
          const characterIdFromUrl = searchParams.get('character')
          const targetCharacter = characterIdFromUrl
            ? charactersData.find((c: Character) => c.id === characterIdFromUrl)
            : null
          setCurrentCharacter(targetCharacter || charactersData[0])
        }
      }
    } catch (error) {
      console.error("加载角色失败:", error)
      toast({
        title: "加载失败",
        description: "无法加载角色列表",
        variant: "destructive",
      })
    }
  }, [currentCharacter, userId, searchParams])

  const loadUserSettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/user-settings?userId=${userId}`)
      const result = await response.json()

      if (result.success) {
        const bg = result.settings.chatBackground || ""
        setDefaultBackground(bg)
        // 不在这里设置 chatBackground，让应用背景 useEffect 统一处理
        // 避免因闭包捕获旧值导致的竞态条件
      }
    } catch (error) {
      console.error("加载用户设置失败:", error)
    }
  }, [userId])

  useEffect(() => {
    const initializeData = async () => {
      setIsLoadingData(true)
      try {
        await Promise.all([loadCharacters(), loadUserSettings()])
      } catch (error) {
        console.error("初始化失败:", error)
      } finally {
        setIsLoadingData(false)
      }
    }

    initializeData()
  }, [loadCharacters, loadUserSettings])

  useEffect(() => {
    if (currentCharacter) {
      loadMessages(currentCharacter.id)
    }
  }, [currentCharacter, loadMessages])

  // 当角色切换时，更新 URL 参数
  useEffect(() => {
    if (currentCharacter && !isLoadingData) {
      const currentUrlCharacterId = searchParams.get('character')
      if (currentUrlCharacterId !== currentCharacter.id) {
        router.replace(`?character=${currentCharacter.id}`, { scroll: false })
      }
    }
  }, [currentCharacter, isLoadingData, router, searchParams])

  // 当切换角色或加载完成时，应用该角色的背景；若角色无背景，使用用户全局背景
  useEffect(() => {
    if (currentCharacter) {
      const nextBg = currentCharacter.background && currentCharacter.background.length > 0
        ? currentCharacter.background
        : defaultBackground
      setChatBackground(nextBg)
    } else if (defaultBackground) {
      // 如果没有选中角色但有全局背景，使用全局背景
      setChatBackground(defaultBackground)
    }
  }, [currentCharacter?.id, currentCharacter?.background, defaultBackground])

  const handleSaveCharacter = useCallback(
    async (characterData: Omit<Character, "id"> & { id?: string }) => {
      try {
        if (characterData.id) {
          // 保留现有的透明度设置（如果没有新值的话）
          const existingCharacter = characters.find(c => c.id === characterData.id)
          const response = await fetch(`/api/characters/${characterData.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: characterData.name,
              avatar: characterData.avatar,
              prompt: characterData.prompt,
              background: characterData.background,
              userAvatar: characterData.userAvatar,
              model: characterData.model,
              // 保留现有的背景和透明度设置
              backgroundSize: existingCharacter?.backgroundSize,
              backgroundPosition: existingCharacter?.backgroundPosition,
              backgroundRepeat: existingCharacter?.backgroundRepeat,
              bubbleUserOpacity: characterData.bubbleUserOpacity ?? existingCharacter?.bubbleUserOpacity,
              bubbleAiOpacity: characterData.bubbleAiOpacity ?? existingCharacter?.bubbleAiOpacity,
            }),
          })

          if (response.ok) {
            await loadCharacters()
            if (currentCharacter?.id === characterData.id) {
              setCurrentCharacter({
                id: characterData.id,
                name: characterData.name,
                avatar: characterData.avatar,
                prompt: characterData.prompt,
                background: characterData.background,
                userAvatar: characterData.userAvatar,
                model: characterData.model,
                backgroundSize: existingCharacter?.backgroundSize,
                backgroundPosition: existingCharacter?.backgroundPosition,
                backgroundRepeat: existingCharacter?.backgroundRepeat,
                bubbleUserOpacity: characterData.bubbleUserOpacity ?? existingCharacter?.bubbleUserOpacity,
                bubbleAiOpacity: characterData.bubbleAiOpacity ?? existingCharacter?.bubbleAiOpacity,
              })
            }
            toast({ title: "角色更新成功" })
          }
        } else {
          const response = await fetch("/api/characters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: characterData.name,
              avatar: characterData.avatar,
              prompt: characterData.prompt,
              background: characterData.background,
              userAvatar: characterData.userAvatar,
              model: characterData.model,
              bubbleUserOpacity: characterData.bubbleUserOpacity ?? 1,
              bubbleAiOpacity: characterData.bubbleAiOpacity ?? 1,
              userId,
            }),
          })

          if (response.ok) {
            await loadCharacters()
            toast({ title: "角色创建成功" })
          }
        }
      } catch (error) {
        console.error("保存角色失败:", error)
        toast({
          title: "保存失败",
          description: "无法保存角色信息",
          variant: "destructive",
        })
      }
    },
    [currentCharacter, loadCharacters, userId],
  )

  const confirmDeleteCharacter = useCallback(async () => {
    if (characterToDelete) {
      try {
        const response = await fetch(`/api/characters/${characterToDelete.id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          await loadCharacters()
          if (currentCharacter?.id === characterToDelete.id && characters.length > 1) {
            const remainingCharacters = characters.filter((char) => char.id !== characterToDelete.id)
            if (remainingCharacters.length > 0) {
              setCurrentCharacter(remainingCharacters[0])
            }
          }
          toast({ title: "角色删除成功" })
        }
      } catch (error) {
        console.error("删除角色失败:", error)
        toast({
          title: "删除失败",
          description: "无法删除角色",
          variant: "destructive",
        })
      }

      setDeleteDialogOpen(false)
      setCharacterToDelete(undefined)
    }
  }, [characterToDelete, currentCharacter, characters, loadCharacters])

  const handleBackgroundChange = useCallback(
    async (opts: { background: string; size: "cover" | "contain" | "auto"; position: string; repeat: string; bubbleUserOpacity: number; bubbleAiOpacity: number }) => {
      const { background, size, position, repeat, bubbleUserOpacity, bubbleAiOpacity } = opts
      setChatBackground(background)

      try {
        if (currentCharacter) {
          // 更新当前角色的背景设置
          const res = await fetch(`/api/characters/${currentCharacter.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: currentCharacter.name,
              avatar: currentCharacter.avatar,
              prompt: currentCharacter.prompt,
              background,
              backgroundSize: size,
              backgroundPosition: position,
              backgroundRepeat: repeat,
              bubbleUserOpacity,
              bubbleAiOpacity,
            }),
          })
          if (res.ok) {
            // 同步本地状态中的角色数据
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === currentCharacter.id
                  ? {
                      ...c,
                      background,
                      backgroundSize: size,
                      backgroundPosition: position,
                      backgroundRepeat: repeat,
                      bubbleUserOpacity,
                      bubbleAiOpacity,
                    }
                  : c,
              ),
            )
            setCurrentCharacter((prev) =>
              prev
                ? {
                    ...prev,
                    background,
                    backgroundSize: size,
                    backgroundPosition: position,
                    backgroundRepeat: repeat,
                    bubbleUserOpacity,
                    bubbleAiOpacity,
                  }
                : prev,
            )
          }
        } else {
          // 作为兜底，写入全局用户设置（仅背景本身）
          await fetch("/api/user-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, chatBackground: background }),
          })
        }
      } catch (error) {
        console.error("保存背景设置失败:", error)
      }
    },
    [currentCharacter, userId],
  )

  const [aiComposing, setAiComposing] = useState(false)

  const handleSendMessage = useCallback(
    async (content: string, imageUrls?: string[]) => {
      if (!currentCharacter) return
      await sendMessage(content, currentCharacter, imageUrls)
    },
    [currentCharacter, sendMessage],
  )

  const handleAiCompose = useCallback(async (): Promise<string> => {
    if (!currentCharacter) return ""
    setAiComposing(true)
    try {
      const assistPrompt =
        "你是AI回信助手。根据给定的对话上下文，代替user回复，用自然、真诚的中文起草一条要发送的回复。注意：你来代替user回复"

      const history = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      }))

      const composePrompt = `你是AI回信助手。你的任务是：根据给定的对话上下文，替“用户”起草下一条要发送的消息。

严格身份与输出要求：
1) 你要扮演“用户”（即对话记录里标记为“用户:”的一方），对方是“助手”（其人物是「${currentCharacter.name}」）。
2) 以第一人称“我”写作，模仿历史中“用户”的用词与语气；不要自称为AI。
3) 只输出用户要发出去的正文，不要包含“用户:”或“助手:”等前缀，不要输出解释、提示或客套开场/结尾。
4) 必要时可很简短地复述对方要点后再回应，整体保持简洁自然。
5) 如果需要称呼对方，使用自然称呼。
6) 若历史对话能看出用户的身份/名字（如“宫村”），请沿用该身份与口吻写作。`

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          character: { prompt: composePrompt + "\n补充要求：请写成2-4句、信息充实，不少于40字；如合适，附带1个自然的追问。" },
          // 使用 DeepSeek 进行 AI 帮回
          model: "deepseek-chat",
        }),
      })
      if (!resp.ok) throw new Error(`AI生成失败: ${resp.status}`)

      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let draft = ""
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const lines = block.split("\n")
            for (const l of lines) {
              const line = l.trim()
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data?.content) draft += data.content
                } catch {}
              }
            }
          }
        }
        if (buffer.trim().length) {
          const lines = buffer.split("\n")
          for (const l of lines) {
            const line = l.trim()
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data?.content) draft += data.content
              } catch {}
            }
          }
        }
      }
      if (!draft.trim()) throw new Error("AI未返回内容")
      return draft
    } catch (e: any) {
      toast({ title: "AI帮回失败", description: e?.message || "请稍后重试", variant: "destructive" })
      return ""
    } finally {
      setAiComposing(false)
    }
  }, [currentCharacter, messages])

  const handleMessageSelect = useCallback((messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" })
      messageElement.classList.add("highlight-message")
      setTimeout(() => {
        messageElement.classList.remove("highlight-message")
      }, 2000)
    }
  }, [])

  const handleNewChat = useCallback(async () => {
    if (currentCharacter) {
      await clearConversation(currentCharacter.id)
      toast({ title: "已开始新对话" })
    }
  }, [currentCharacter, clearConversation])

  const chatStyle = useMemo(
    () => ({
      backgroundColor: "var(--background)",
      backgroundImage: chatBackground && chatBackground.trim().length > 0 ? chatBackground : "none",
      backgroundSize: currentCharacter?.backgroundSize || "cover",
      backgroundPosition: currentCharacter?.backgroundPosition || "center",
      backgroundRepeat: currentCharacter?.backgroundRepeat || "no-repeat",
      backgroundAttachment: "fixed",
      paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
    }),
    [chatBackground, keyboardHeight, currentCharacter?.backgroundSize, currentCharacter?.backgroundPosition, currentCharacter?.backgroundRepeat],
  )

  // Memoize current role background options to avoid hook order issues
  const backgroundOptions = useMemo(
    () => ({
      size: (currentCharacter?.backgroundSize as "cover" | "contain" | "auto") || "cover",
      position: currentCharacter?.backgroundPosition || "center",
      repeat: (currentCharacter?.backgroundRepeat as "repeat" | "no-repeat" | "repeat-x" | "repeat-y") || "no-repeat",
      bubbleUserOpacity: currentCharacter?.bubbleUserOpacity ?? 1,
      bubbleAiOpacity: currentCharacter?.bubbleAiOpacity ?? 1,
    }),
    [
      currentCharacter?.backgroundSize,
      currentCharacter?.backgroundPosition,
      currentCharacter?.backgroundRepeat,
      currentCharacter?.bubbleUserOpacity,
      currentCharacter?.bubbleAiOpacity,
    ],
  )

  if (isLoadingData) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <KeyboardShortcuts
        onSearch={() => setSearchOpen(true)}
        onSettings={() => setBackgroundDialogOpen(true)}
      />

      <div className="flex h-[100dvh] bg-background overflow-hidden">
        <div className={`${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden' : 'lg:w-80'} transition-all duration-300 ease-in-out`}>
          <CharacterSidebar
            characters={characters}
            currentCharacter={currentCharacter!}
            onSelectCharacter={setCurrentCharacter}
            onAddCharacter={() => {
              setEditingCharacter(undefined)
              setCharacterDialogOpen(true)
            }}
            onEditCharacter={(character) => {
              setEditingCharacter(character)
              setCharacterDialogOpen(true)
            }}
            onDeleteCharacter={(character) => {
              setCharacterToDelete(character)
              setDeleteDialogOpen(true)
            }}
            onSettings={() => setBackgroundDialogOpen(true)}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isCollapsed={sidebarCollapsed}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0" style={chatStyle}>
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card/90 backdrop-blur-sm">
            <div className="flex items-center space-x-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden h-9 w-9 p-0 touch-manipulation"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex h-9 w-9 p-0"
                title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
                </svg>
              </Button>
              {currentCharacter && (
                <>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-muted">
                    <img
                      src={currentCharacter.avatar || "/placeholder.svg"}
                      alt={currentCharacter.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-card-foreground text-sm sm:text-base truncate">
                      {currentCharacter.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{isLoading ? "正在思考..." : "在线"}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {currentCharacter && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingCharacter(currentCharacter)
                      setCharacterDialogOpen(true)
                    }}
                    className="h-8 w-8 p-0"
                    title="编辑当前角色"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCharacterToDelete(currentCharacter)
                      setDeleteDialogOpen(true)
                    }}
                    className="h-8 w-8 p-0"
                    title="删除当前角色"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              <ThemeToggle />
              {isLoading && (
                <Button variant="outline" size="sm" onClick={cancelCurrentRequest} className="text-xs bg-transparent">
                  取消
                </Button>
              )}
            </div>
          </div>

          <MessageList
            messages={messages}
            characters={characters}
            currentCharacter={currentCharacter!}
            isLoading={isLoading}
            onNewConversation={handleNewChat}
            onRegenerate={currentCharacter ? () => regenerateLastMessage(currentCharacter) : undefined}
          />

          <MessageInput
            onSendMessage={handleSendMessage}
            onAiCompose={handleAiCompose}
            aiComposing={aiComposing}
            disabled={isLoading || !currentCharacter}
            placeholder={isLoading ? "AI正在回复中..." : !currentCharacter ? "请先选择一个角色..." : "输入消息..."}
          />
        </div>

        <MessageSearch
          messages={messages.map(m => ({
            ...m,
            characterId: m.characterId ?? (currentCharacter ? currentCharacter.id : ""),
          }))}
          onMessageSelect={handleMessageSelect}
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
        />

        <CharacterDialog
          open={characterDialogOpen}
          onOpenChange={setCharacterDialogOpen}
          character={editingCharacter}
          onSave={handleSaveCharacter}
          mode={editingCharacter ? "edit" : "create"}
        />

        <BackgroundSettings
          open={backgroundDialogOpen}
          onOpenChange={setBackgroundDialogOpen}
          currentBackground={chatBackground}
          currentOptions={backgroundOptions}
          onBackgroundChange={handleBackgroundChange}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="mx-4 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除角色</AlertDialogTitle>
              <AlertDialogDescription>
                你确定要删除角色 "{characterToDelete?.name}" 吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteCharacter}
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  )
}
