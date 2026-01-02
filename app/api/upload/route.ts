import { existsSync } from "fs"
import { mkdir, writeFile } from "fs/promises"
import { type NextRequest, NextResponse } from "next/server"
import { join } from "path"

// 最大文件大小 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string // "avatar" | "background" | "chat"

    if (!file) {
      console.error("上传错误: 没有找到文件")
      return NextResponse.json({ error: "没有找到文件" }, { status: 400 })
    }

    console.log(`上传文件: ${file.name}, 类型: ${file.type}, 大小: ${file.size} bytes`)

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      console.error(`上传错误: 不支持的文件类型 ${file.type}`)
      return NextResponse.json({ error: `只支持图片文件，当前类型: ${file.type}` }, { status: 400 })
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      console.error(`上传错误: 文件太大 ${file.size} bytes`)
      return NextResponse.json({ error: `文件大小不能超过10MB，当前: ${(file.size / 1024 / 1024).toFixed(2)}MB` }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 生成唯一文件名
    const timestamp = Date.now()
    const extension = file.name.split(".").pop()
    const filename = `${type}_${timestamp}.${extension}`

    // 确保上传目录存在
    const uploadDir = join(process.cwd(), "public", "uploads")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 保存文件
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // 返回文件URL（使用API路由服务图片，确保生产环境可访问）
    const fileUrl = `/api/uploads/${filename}`

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: filename,
    })
  } catch (error) {
    console.error("文件上传错误:", error)
    return NextResponse.json({ error: "文件上传失败" }, { status: 500 })
  }
}
