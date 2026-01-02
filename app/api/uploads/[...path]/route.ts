import { existsSync } from "fs"
import { readFile } from "fs/promises"
import { type NextRequest, NextResponse } from "next/server"
import { join } from "path"

// 支持的图片MIME类型
const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const filePath = path.join("/")
    
    // 安全检查：防止路径遍历攻击
    if (filePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const fullPath = join(process.cwd(), "public", "uploads", filePath)

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const fileBuffer = await readFile(fullPath)
    const ext = filePath.split(".").pop()?.toLowerCase() || ""
    const contentType = mimeTypes[ext] || "application/octet-stream"

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("读取文件错误:", error)
    return NextResponse.json({ error: "读取文件失败" }, { status: 500 })
  }
}