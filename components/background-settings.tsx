"use client"

import type React from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Upload, X } from "lucide-react"
import { useEffect, useState } from "react"

interface BackgroundSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBackground: string
  currentOptions?: {
    size?: "cover" | "contain" | "auto"
    position?: string
    repeat?: "no-repeat" | "repeat" | "repeat-x" | "repeat-y"
    bubbleUserOpacity?: number
    bubbleAiOpacity?: number
  }
  onBackgroundChange: (opts: {
    background: string
    size: "cover" | "contain" | "auto"
    position: string
    repeat: "no-repeat" | "repeat" | "repeat-x" | "repeat-y"
    bubbleUserOpacity: number
    bubbleAiOpacity: number
  }) => void
}

export function BackgroundSettings({
  open,
  onOpenChange,
  currentBackground,
  currentOptions,
  onBackgroundChange,
}: BackgroundSettingsProps) {
  const [background, setBackground] = useState(currentBackground)
  const [size, setSize] = useState<"cover" | "contain" | "auto">(currentOptions?.size || "cover")
  const [position, setPosition] = useState<string>(currentOptions?.position || "center")
  const [repeat, setRepeat] = useState<"no-repeat" | "repeat" | "repeat-x" | "repeat-y">(
    currentOptions?.repeat || "no-repeat",
  )
  const [isUploading, setIsUploading] = useState(false)
  const [userOpacity, setUserOpacity] = useState<number>(currentOptions?.bubbleUserOpacity ?? 1)
  const [aiOpacity, setAiOpacity] = useState<number>(currentOptions?.bubbleAiOpacity ?? 1)

  // 同步打开时的初值（按字段依赖，避免每次渲染都重置导致下拉立刻关闭）
  useEffect(() => {
    if (open) {
      setBackground(currentBackground)
      setSize(currentOptions?.size || "cover")
      setPosition(currentOptions?.position || "center")
      setRepeat((currentOptions?.repeat as any) || "no-repeat")
      setUserOpacity(currentOptions?.bubbleUserOpacity ?? 1)
      setAiOpacity(currentOptions?.bubbleAiOpacity ?? 1)
    }
  }, [open, currentBackground, currentOptions?.size, currentOptions?.position, currentOptions?.repeat])

  const presetBackgrounds = [
    { name: "默认", url: "" },
    { name: "渐变蓝", url: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { name: "渐变绿", url: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
    { name: "渐变紫", url: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" },
    { name: "深色", url: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)" },
  ]

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "background")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setBackground(`url(${result.url})`)
      } else {
        console.error("上传失败:", result.error)
      }
    } catch (error) {
      console.error("上传错误:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = () => {
    onBackgroundChange({ background, size, position, repeat, bubbleUserOpacity: userOpacity, bubbleAiOpacity: aiOpacity })
    onOpenChange(false)
  }

  const handleCancel = () => {
    setBackground(currentBackground)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">聊天背景设置</DialogTitle>
          <DialogDescription className="text-sm">选择预设背景或上传自定义背景图片</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 预览区域 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">背景预览</Label>
            <div
              className="w-full h-24 sm:h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center"
              style={{
                backgroundColor: "var(--background)",
                backgroundImage: background && background.trim().length > 0 ? background : "none",
                backgroundSize: size,
                backgroundPosition: position,
                backgroundRepeat: repeat,
              }}
            >
              <div className="text-sm text-muted-foreground bg-background/80 px-3 py-1 rounded">预览效果</div>
            </div>
          </div>

          {/* 预设背景 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">预设背景</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {presetBackgrounds.map((preset) => (
                <button
                  key={preset.name}
                  className={`h-12 sm:h-16 rounded-lg border-2 transition-colors touch-manipulation ${
                    background === preset.url ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                  style={{
                    backgroundColor: "var(--background)",
                    backgroundImage: preset.url && preset.url.trim().length > 0 ? preset.url : "none",
                    backgroundSize: size,
                    backgroundPosition: position,
                    backgroundRepeat: repeat,
                  }}
                  onClick={() => setBackground(preset.url)}
                >
                  <span className="sr-only">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 自定义上传 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">自定义背景</Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <Label htmlFor="background-upload" className="cursor-pointer flex-1">
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-4 py-3 sm:py-2 w-full touch-manipulation">
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>上传中...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>上传背景图片</span>
                    </>
                  )}
                </div>
              </Label>
              <Input
                id="background-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBackgroundUpload}
                disabled={isUploading}
              />
              {background && background.startsWith("url(") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBackground("")}
                  disabled={isUploading}
                  className="w-full sm:w-auto h-10 touch-manipulation"
                >
                  <X className="h-4 w-4 mr-1" />
                  移除
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 显示选项 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">大小</Label>
            <Select value={size} onValueChange={(v) => setSize(v as any)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择大小" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">填充（裁剪）</SelectItem>
                <SelectItem value="contain">完整显示（留空白）</SelectItem>
                <SelectItem value="auto">原始尺寸</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">对齐</Label>
            <Select value={position} onValueChange={(v) => setPosition(v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择对齐" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">中心</SelectItem>
                <SelectItem value="top">上</SelectItem>
                <SelectItem value="bottom">下</SelectItem>
                <SelectItem value="left">左</SelectItem>
                <SelectItem value="right">右</SelectItem>
                <SelectItem value="top left">左上</SelectItem>
                <SelectItem value="top right">右上</SelectItem>
                <SelectItem value="bottom left">左下</SelectItem>
                <SelectItem value="bottom right">右下</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">平铺</Label>
            <Select value={repeat} onValueChange={(v) => setRepeat(v as any)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择平铺" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-repeat">不平铺</SelectItem>
                <SelectItem value="repeat">平铺</SelectItem>
                <SelectItem value="repeat-x">横向平铺</SelectItem>
                <SelectItem value="repeat-y">纵向平铺</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 气泡透明度 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">用户气泡透明度</Label>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={userOpacity}
              onChange={(e) => setUserOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">{Math.round(userOpacity * 100)}%</div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">AI 气泡透明度</Label>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={aiOpacity}
              onChange={(e) => setAiOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">{Math.round(aiOpacity * 100)}%</div>
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
            disabled={isUploading}
            className="w-full sm:w-auto h-10 touch-manipulation"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
