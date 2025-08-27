"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Search, Settings, X, Trash2, Pencil } from "lucide-react"

interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
}

interface CharacterSidebarProps {
  characters: Character[]
  currentCharacter: Character
  onSelectCharacter: (character: Character) => void
  onAddCharacter: () => void
  onEditCharacter: (character: Character) => void
  onDeleteCharacter: (character: Character) => void
  onSettings: () => void
  isOpen: boolean
  onClose: () => void
  isCollapsed?: boolean
}

export function CharacterSidebar({
  characters,
  currentCharacter,
  onSelectCharacter,
  onAddCharacter,
  onEditCharacter,
  onDeleteCharacter,
  onSettings,
  isOpen,
  onClose,
  isCollapsed = false,
}: CharacterSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredCharacters = useMemo(() => {
    const q = String(searchQuery || "").toLowerCase().trim()
    if (!q) return characters || []

    return (characters || []).filter((character) => {
      const name = String(character?.name ?? "").toLowerCase()
      const prompt = String(character?.prompt ?? "").toLowerCase()
      return name.includes(q) || prompt.includes(q)
    })
  }, [characters, searchQuery])

  const handleSelectCharacter = useCallback(
    (character: Character) => {
      onSelectCharacter(character)
      // 在移动端选择角色后自动关闭侧边栏
      if (window.innerWidth < 768) {
        onClose()
      }
    },
    [onSelectCharacter, onClose],
  )

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}

      <div
        className={`
        fixed lg:relative top-0 left-0 h-full w-80 bg-background border-r z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isCollapsed ? "lg:hidden" : "lg:block"}
        flex flex-col
      `}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">AI 角色</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onSettings} className="w-8 h-8 p-0">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 md:hidden">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索角色..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredCharacters.map((character) => (
              <div key={character.id} className="flex items-center gap-2 mb-1">
                <Button
                  variant={currentCharacter?.id === character.id ? "secondary" : "ghost"}
                  className="flex-1 justify-start p-3 h-auto"
                  onClick={() => handleSelectCharacter(character)}
                  onDoubleClick={() => onEditCharacter(character)}
                >
                  <Avatar className="w-8 h-8 mr-3">
                    <AvatarImage src={character?.avatar || "/placeholder.svg"} alt={character?.name || "角色"} />
                    <AvatarFallback>{character?.name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{character?.name || "未命名角色"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {(character?.prompt || "").slice(0, 50)}{(character?.prompt || "").length > 50 ? "..." : ""}
                    </div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-destructive"
                  title="删除此角色"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteCharacter(character)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0"
                  title="编辑此角色"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditCharacter(character)
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {filteredCharacters.length === 0 && searchQuery && (
              <div className="text-center text-muted-foreground py-8">未找到匹配的角色</div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button onClick={onAddCharacter} className="w-full bg-transparent" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            添加新角色
          </Button>
        </div>
      </div>
    </>
  )
}
