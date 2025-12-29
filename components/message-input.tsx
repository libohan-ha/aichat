"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

// 图片压缩阈值（3.5MB，留一些余量给base64编码增加的体积）
const IMAGE_COMPRESS_THRESHOLD = 3.5 * 1024 * 1024

// 压缩图片
async function compressImage(file: File, maxSizeBytes: number = IMAGE_COMPRESS_THRESHOLD): Promise<File> {
  // 如果图片已经足够小，直接返回
  if (file.size <= maxSizeBytes) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = async () => {
      try {
        let { width, height } = img
        let quality = 0.9
        let blob: Blob | null = null

        // 如果图片尺寸过大，先缩小尺寸
        const maxDimension = 2048
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)

        // 逐步降低质量直到文件大小满足要求
        while (quality > 0.1) {
          blob = await new Promise<Blob | null>((res) => {
            canvas.toBlob(res, 'image/jpeg', quality)
          })

          if (blob && blob.size <= maxSizeBytes) {
            break
          }

          // 如果还是太大，进一步缩小尺寸
          if (quality <= 0.5 && blob && blob.size > maxSizeBytes) {
            width = Math.round(width * 0.8)
            height = Math.round(height * 0.8)
            canvas.width = width
            canvas.height = height
            ctx?.drawImage(img, 0, 0, width, height)
          }

          quality -= 0.1
        }

        if (blob) {
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          console.log(`图片压缩: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
          resolve(compressedFile)
        } else {
          resolve(file)
        }
      } catch (error) {
        console.error('图片压缩失败:', error)
        resolve(file)
      }
    }

    img.onerror = () => {
      console.error('图片加载失败')
      resolve(file)
    }

    img.src = URL.createObjectURL(file)
  })
}

interface MessageInputProps {
  onSendMessage: (content: string, imageUrls?: string[]) => void
  disabled?: boolean
  placeholder?: string
  onAiCompose?: () => Promise<string>
  aiComposing?: boolean
}

export function MessageInput({ onSendMessage, disabled, placeholder = "输入消息...", onAiCompose, aiComposing }: MessageInputProps) {
  const [message, setMessage] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      // 只根据窗口宽度判断是否为移动端，不使用触摸屏检测
      // 因为很多笔记本电脑也有触摸屏
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // 自动聚焦到输入框（当 disabled 从 true 变为 false 时，即 AI 回复完成后）
  const prevDisabledRef = useRef(disabled)
  useEffect(() => {
    // 检测 disabled 从 true 变为 false 的情况（AI 回复完成）
    if (prevDisabledRef.current === true && disabled === false && !isMobile) {
      // 使用 setTimeout 确保 DOM 已更新，延迟稍长一点确保可靠
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          console.log("AI回复完成，自动聚焦到输入框")
        }
      }, 100)
    }
    prevDisabledRef.current = disabled
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
    if ((!message.trim() && selectedImages.length === 0) || disabled) return

    onSendMessage(message.trim(), selectedImages.length > 0 ? selectedImages : undefined)
    setMessage("")
    setSelectedImages([])

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
  }, [message, selectedImages, disabled, onSendMessage, isMobile])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey

        if (isMobile) {
          // 移动端：Enter键换行，需要点击发送按钮发送
          return
        }

        // 桌面端：Enter 发送，Ctrl/Cmd + Enter 换行
        if (isCtrlOrCmd) {
          // Ctrl/Cmd + Enter: 换行，不阻止默认行为
          return
        }

        // Enter: 发送消息
        e.preventDefault()
        handleSend()
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

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 验证文件类型
        if (!file.type.startsWith("image/")) {
          return null
        }

        // 压缩大图片
        const processedFile = await compressImage(file)

        const formData = new FormData()
        formData.append("file", processedFile)
        formData.append("type", "chat")

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const result = await response.json()
        if (result.success) {
          return result.url
        }
        return null
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      const validUrls = uploadedUrls.filter((url): url is string => url !== null)
      
      if (validUrls.length > 0) {
        setSelectedImages(prev => [...prev, ...validUrls])
      }
    } catch (error) {
      console.error("图片上传失败:", error)
    } finally {
      setIsUploading(false)
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [])

  const handleRemoveImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div
      className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur-sm p-3 sm:p-4"
      style={{
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : undefined,
      }}
    >
      {/* 图片预览 */}
      {selectedImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedImages.map((img, index) => (
            <div key={index} className="relative inline-block">
              <img
                src={img}
                alt={`待发送图片 ${index + 1}`}
                className="max-h-24 sm:max-h-32 rounded-lg border border-border object-cover"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

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
            disabled={disabled || (!message.trim() && selectedImages.length === 0)}
            size="sm"
            className={`p-0 touch-manipulation ${isMobile ? "w-9 h-9" : "w-10 h-10"}`}
          >
            <Send className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className={`p-0 touch-manipulation ${isMobile ? "w-9 h-9" : "w-10 h-10"}`}
            title="添加图片"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
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
