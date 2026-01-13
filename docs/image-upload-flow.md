# AI 图片上传逻辑文档

## 概述

本项目支持用户在聊天时上传图片给 AI 分析。整个流程涉及以下关键文件：

- `components/message-input.tsx` - 前端图片选择和上传
- `app/api/upload/route.ts` - 图片上传 API
- `hooks/use-chat.ts` - 聊天逻辑，处理图片消息
- `app/api/chat/route.ts` - AI 聊天 API，将图片转换为 base64 发送给 AI

---

## 流程图

```
用户选择图片
     ↓
前端压缩图片 (如果>3.5MB)
     ↓
上传到 /api/upload
     ↓
保存到 public/uploads/
     ↓
返回图片URL (/api/uploads/xxx.jpg)
     ↓
用户点击发送
     ↓
调用 /api/chat，传递 imageUrls
     ↓
后端读取图片文件，转换为base64
     ↓
发送给AI API (OpenAI格式的多模态消息)
     ↓
AI返回分析结果
```

---

## 1. 前端图片选择和压缩

**文件**: `components/message-input.tsx`

### 图片压缩函数 (第 14-88 行)

```typescript
const IMAGE_COMPRESS_THRESHOLD = 3.5 * 1024 * 1024; // 3.5MB

async function compressImage(file: File, maxSizeBytes: number): Promise<File> {
  // 如果图片已经足够小，直接返回
  if (file.size <= maxSizeBytes) return file;

  // 使用Canvas压缩图片：
  // 1. 如果尺寸 > 2048px，先缩小尺寸
  // 2. 逐步降低JPEG质量 (0.9 -> 0.1)
  // 3. 如果还是太大，继续缩小尺寸 (0.8倍)
}
```

### 图片上传处理 (第 274-320 行)

```typescript
const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;

  for (const file of files) {
    // 1. 验证文件类型
    if (!file.type.startsWith("image/")) continue;

    // 2. 压缩大图片
    const processedFile = await compressImage(file);

    // 3. 上传到服务器
    const formData = new FormData();
    formData.append("file", processedFile);
    formData.append("type", "chat");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    // 4. 获取图片URL，添加到待发送列表
    const result = await response.json();
    if (result.success) {
      setSelectedImages((prev) => [...prev, result.url]);
    }
  }
};
```

---

## 2. 图片上传 API

**文件**: `app/api/upload/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file") as File
  const type = formData.get("type") as string  // "avatar" | "background" | "chat"

  // 验证
  if (!file.type.startsWith("image/")) return error
  if (file.size > 10MB) return error

  // 生成唯一文件名
  const filename = `${type}_${Date.now()}.${extension}`

  // 保存到 public/uploads/
  const uploadDir = join(process.cwd(), "public", "uploads")
  await writeFile(filepath, buffer)

  // 返回API路由URL（确保生产环境可访问）
  return { success: true, url: `/api/uploads/${filename}` }
}
```

---

## 3. 发送消息时处理图片

**文件**: `hooks/use-chat.ts`

### sendMessage 函数 (第 33-218 行)

```typescript
const sendMessage = async (
  content: string,
  character: Character,
  imageUrls?: string[]
) => {
  // 1. 创建用户消息（包含图片URL）
  const userMessage = {
    content: content.trim(),
    sender: "user",
    imageUrls, // 图片URL列表
  };

  // 2. 保存到数据库
  await fetch("/api/messages", {
    method: "POST",
    body: JSON.stringify({
      content: userMessage.content,
      role: "user",
      images: imageUrls, // 存储图片URL
    }),
  });

  // 3. 调用AI API
  // 注意：只给最新消息传递图片，历史消息不传图片
  const response = await fetch("/api/chat", {
    body: JSON.stringify({
      messages: allMessages.map((msg, index) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
        // 只有最后一条消息才传递图片
        imageUrls: index === allMessages.length - 1 ? msg.imageUrls : undefined,
      })),
      character,
    }),
  });

  // 4. 处理AI流式响应...
};
```

---

## 4. AI API 处理图片

**文件**: `app/api/chat/route.ts`

### 图片转 base64 (第 56-89 行)

```typescript
function convertLocalImageToBase64(imageUrl: string): string {
  // 处理API路由路径和静态路径
  let relativePath = imageUrl;
  if (imageUrl.startsWith("/api/uploads/")) {
    relativePath = imageUrl.replace("/api/uploads/", "/uploads/");
  }

  // 读取文件
  const imagePath = path.join(process.cwd(), "public", relativePath);
  const imageBuffer = fs.readFileSync(imagePath);

  // 检测MIME类型（通过文件头magic bytes）
  const mimeType = detectMimeType(imageBuffer);

  // 转换为base64 data URL
  return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
}
```

### 格式化消息为 OpenAI 多模态格式 (第 92-127 行)

```typescript
function formatMessagesWithImages(messages) {
  return messages.map((msg) => {
    // 没有图片，返回普通文本消息
    if (!msg.imageUrls || msg.imageUrls.length === 0) {
      return { role: msg.role, content: msg.content };
    }

    // 有图片，构建多模态内容数组
    const contentParts = [];

    // 添加文本
    if (msg.content.trim()) {
      contentParts.push({ type: "text", text: msg.content });
    }

    // 添加图片（转换为base64）
    for (const imageUrl of msg.imageUrls) {
      const base64Url = convertLocalImageToBase64(imageUrl);
      contentParts.push({
        type: "image_url",
        image_url: { url: base64Url },
      });
    }

    return { role: msg.role, content: contentParts };
  });
}
```

### 发送给 AI API (第 129-243 行)

```typescript
export async function POST(request: NextRequest) {
  const { messages, character } = await request.json();

  // 系统提示词
  const systemMessage = {
    role: "system",
    content: character?.prompt || "你是一个友善的AI助手",
  };

  // 格式化消息（处理图片转base64）
  const formattedMessages = formatMessagesWithImages(messages);

  // 调用AI API（OpenAI兼容格式）
  const completion = await openai.chat.completions.create({
    model: chosenModel,
    messages: [systemMessage, ...formattedMessages],
    stream: true,
  });

  // 返回流式响应...
}
```

---

## 5. 发送给 AI 的最终消息格式

当用户发送带图片的消息时，最终发送给 AI 的格式如下：

```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "你是一个友善的AI助手"
    },
    {
      "role": "user",
      "content": "之前的消息内容"
    },
    {
      "role": "assistant",
      "content": "AI的回复"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "帮我分析这张图片"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
          }
        }
      ]
    }
  ]
}
```

---

## 数据库存储

**文件**: `prisma/schema.prisma`

```prisma
model Message {
  id          Int       @id @default(autoincrement())
  content     String
  role        String    // "user" | "assistant"
  images      String[]  // 图片URL数组
  ...
}
```

---

## 关键设计决策

1. **只传最新消息的图片**: 历史消息不重复传递图片，节省 token 消耗
2. **前端压缩**: 大于 3.5MB 的图片在前端压缩，避免上传失败
3. **base64 转换**: 服务端将图片转为 base64，兼容各种 AI API
4. **MIME 类型检测**: 通过文件头检测真实类型，避免扩展名欺骗
