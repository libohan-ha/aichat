"use client"

import type React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, X } from "lucide-react"
import { useEffect, useState } from "react"

interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  userAvatar?: string
  background?: string
  model?: string
}

interface CharacterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  character?: Character
  onSave: (character: Omit<Character, "id"> & { id?: string }) => void
  mode: "create" | "edit"
}

export function CharacterDialog({ open, onOpenChange, character, onSave, mode }: CharacterDialogProps) {
  const [name, setName] = useState(character?.name || "")
  const [prompt, setPrompt] = useState(character?.prompt || "")
  const [avatar, setAvatar] = useState(character?.avatar || "")
  const [userAvatar, setUserAvatar] = useState(character?.userAvatar || "")
  const [background, setBackground] = useState(character?.background || "")
  const [model, setModel] = useState(character?.model || "deepseek-chat")
  const [isUploading, setIsUploading] = useState(false)

  // 同步外部传入的角色到本地状态：当对话框打开或切换角色时预填表单
  // 之前只在初次挂载时取初值，导致编辑时是空的
  useEffect(() => {
    if (open) {
      setName(character?.name || "")
      setPrompt(character?.prompt || "")
      setAvatar(character?.avatar || "")
      setUserAvatar(character?.userAvatar || "")
      setBackground(character?.background || "")
      setModel(character?.model || "deepseek-chat")
    }
  }, [open, character?.id])

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "avatar")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setAvatar(result.url)
      } else {
        console.error("上传失败:", result.error)
        // 可以添加错误提示
      }
    } catch (error) {
      console.error("上传错误:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = () => {
    if (!name.trim() || !prompt.trim()) return

    onSave({
      id: character?.id,
      name: name.trim(),
      prompt: prompt.trim(),
      avatar: avatar || "/placeholder.svg?key=6esse",
      userAvatar: userAvatar || "/placeholder-user.jpg",
      background,
      model,
    })

    // 重置表单
    setName("")
    setPrompt("")
    setAvatar("")
    setUserAvatar("")
    setBackground("")
    setModel("deepseek-chat")
    onOpenChange(false)
  }

  const handleCancel = () => {
    // 重置为原始值
    setName(character?.name || "")
    setPrompt(character?.prompt || "")
    setAvatar(character?.avatar || "")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{mode === "create" ? "创建新角色" : "编辑角色"}</DialogTitle>
          <DialogDescription className="text-sm">
            {mode === "create" ? "创建一个新的AI角色，设置名称、头像和提示词。" : "编辑角色的信息和设置。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 头像上传 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">角色头像</Label>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatar || "/placeholder.svg"} alt="角色头像" />
                <AvatarFallback>{name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md border border-dashed border-border hover:border-primary">
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>上传中...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>点击上传头像</span>
                      </>
                    )}
                  </div>
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isUploading}
                />
                {avatar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-2 text-xs touch-manipulation"
                    onClick={() => setAvatar("")}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3 mr-1" />
                    移除头像
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 用户头像上传 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">我的头像（此角色下显示）</Label>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={userAvatar || "/placeholder-user.jpg"} alt="用户头像" />
                <AvatarFallback>我</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="user-avatar-upload" className="cursor-pointer">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md border border-dashed border-border hover:border-primary">
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>上传中...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>点击上传用户头像</span>
                      </>
                    )}
                  </div>
                </Label>
                <Input
                  id="user-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event: React.ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setIsUploading(true)
                    try {
                      const formData = new FormData()
                      formData.append("file", file)
                      formData.append("type", "user")
                      const response = await fetch("/api/upload", { method: "POST", body: formData })
                      const result = await response.json()
                      if (result.success) setUserAvatar(result.url)
                    } finally {
                      setIsUploading(false)
                    }
                  }}
                  disabled={isUploading}
                />
                {userAvatar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-2 text-xs touch-manipulation"
                    onClick={() => setUserAvatar("")}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3 mr-1" />
                    移除用户头像
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 角色名称 */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              角色名称
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入角色名称"
              maxLength={20}
              className="h-10 text-base"
            />
          </div>

          {/* 模型选择 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">使用模型</Label>
            <Select value={model} onValueChange={(v) => setModel(v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepseek-chat">deepseek-chat（通用）</SelectItem>
                <SelectItem value="deepseek-reasoner">deepseek-reasoner（更强推理）</SelectItem>
                <SelectItem value="gemini-2.0-flash">gemini-2.0-flash（Google）</SelectItem>
                <SelectItem value="claude-opus-4-5-thinking">claude-opus-4-5-thinking（本地）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 提示词 */}
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-sm font-medium">
              角色提示词
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述这个角色的性格、专长和回答风格..."
              className="min-h-[120px] text-base resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">{prompt.length} 字</div>
          </div>

          {/* 背景（可选） */}
          <div className="space-y-2">
            <Label htmlFor="background" className="text-sm font-medium">
              聊天背景（可选）
            </Label>
            <Input
              id="background"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="例如 url(/uploads/bg.png) 或 linear-gradient(...)"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto h-10 touch-manipulation bg-transparent"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !prompt.trim() || isUploading}
            className="w-full sm:w-auto h-10 touch-manipulation"
          >
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
