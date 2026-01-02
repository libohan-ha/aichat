import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export interface Character {
  id: string
  name: string
  avatar: string
  prompt: string
  userId: string
  background?: string
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  userAvatar?: string
  bubbleUserOpacity?: number
  bubbleAiOpacity?: number
  model?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  characterId: string
  conversationId?: string
  userId: string
  images?: string[]
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  userId: string
  characterId: string
  title: string
  messageCount?: number
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  id: string
  userId: string
  chatBackground: string
  currentCharacterId?: string
  createdAt: string
  updatedAt: string
}

class PrismaDB {
  // Characters
  async getCharacters(userId = "default"): Promise<Character[]> {
    const characters = await prisma.character.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return characters.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      avatar: c.avatar,
      prompt: c.prompt,
      userId: c.userId,
      background: c.background || undefined,
      backgroundSize: c.backgroundSize || undefined,
      backgroundPosition: c.backgroundPosition || undefined,
      backgroundRepeat: c.backgroundRepeat || undefined,
      userAvatar: c.userAvatar || undefined,
      bubbleUserOpacity: c.bubbleUserOpacity || undefined,
      bubbleAiOpacity: c.bubbleAiOpacity || undefined,
      model: c.model || undefined,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  async createCharacter(character: Omit<Character, "id" | "createdAt" | "updatedAt">): Promise<Character> {
    const created = await prisma.character.create({
      data: {
        name: character.name || "未命名角色",
        avatar: character.avatar || "/placeholder.svg",
        prompt: character.prompt || "默认提示词",
        userId: character.userId || "default",
        background: character.background || "",
        backgroundSize: character.backgroundSize || "cover",
        backgroundPosition: character.backgroundPosition || "center",
        backgroundRepeat: character.backgroundRepeat || "no-repeat",
        userAvatar: character.userAvatar || "/placeholder-user.jpg",
        bubbleUserOpacity: character.bubbleUserOpacity ?? 1,
        bubbleAiOpacity: character.bubbleAiOpacity ?? 1,
        model: character.model || process.env.DEEPSEEK_MODEL || "deepseek-chat",
      },
    })
    return {
      id: created.id.toString(),
      name: created.name,
      avatar: created.avatar,
      prompt: created.prompt,
      userId: created.userId,
      background: created.background || undefined,
      backgroundSize: created.backgroundSize || undefined,
      backgroundPosition: created.backgroundPosition || undefined,
      backgroundRepeat: created.backgroundRepeat || undefined,
      userAvatar: created.userAvatar || undefined,
      bubbleUserOpacity: created.bubbleUserOpacity || undefined,
      bubbleAiOpacity: created.bubbleAiOpacity || undefined,
      model: created.model || undefined,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    }
  }

  async updateCharacter(id: string, updates: Partial<Character>, userId = "default"): Promise<Character | null> {
    const numId = parseInt(id)
    const existing = await prisma.character.findFirst({
      where: { id: numId, userId },
    })
    if (!existing) return null

    const updated = await prisma.character.update({
      where: { id: numId },
      data: {
        name: updates.name,
        avatar: updates.avatar,
        prompt: updates.prompt,
        background: updates.background,
        backgroundSize: updates.backgroundSize,
        backgroundPosition: updates.backgroundPosition,
        backgroundRepeat: updates.backgroundRepeat,
        userAvatar: updates.userAvatar,
        bubbleUserOpacity: updates.bubbleUserOpacity,
        bubbleAiOpacity: updates.bubbleAiOpacity,
        model: updates.model,
      },
    })
    return {
      id: updated.id.toString(),
      name: updated.name,
      avatar: updated.avatar,
      prompt: updated.prompt,
      userId: updated.userId,
      background: updated.background || undefined,
      backgroundSize: updated.backgroundSize || undefined,
      backgroundPosition: updated.backgroundPosition || undefined,
      backgroundRepeat: updated.backgroundRepeat || undefined,
      userAvatar: updated.userAvatar || undefined,
      bubbleUserOpacity: updated.bubbleUserOpacity || undefined,
      bubbleAiOpacity: updated.bubbleAiOpacity || undefined,
      model: updated.model || undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }

  async deleteCharacter(id: string, userId = "default"): Promise<boolean> {
    const numId = parseInt(id)
    const existing = await prisma.character.findFirst({
      where: { id: numId, userId },
    })
    if (!existing) return false

    await prisma.character.delete({ where: { id: numId } })
    return true
  }

  // Conversations
  async getConversations(userId = "default", characterId: string): Promise<Conversation[]> {
    const conversations = await prisma.conversation.findMany({
      where: { userId, characterId: parseInt(characterId) },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })
    return conversations.map((c) => ({
      id: c.id.toString(),
      userId: c.userId,
      characterId: c.characterId.toString(),
      title: c.title,
      messageCount: c._count.messages,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  async createConversation(userId = "default", characterId: string, title = "新对话"): Promise<Conversation> {
    const created = await prisma.conversation.create({
      data: {
        userId,
        characterId: parseInt(characterId),
        title,
      },
    })
    return {
      id: created.id.toString(),
      userId: created.userId,
      characterId: created.characterId.toString(),
      title: created.title,
      messageCount: 0,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    }
  }

  async updateConversation(conversationId: string, updates: { title?: string }): Promise<Conversation | null> {
    try {
      const updated = await prisma.conversation.update({
        where: { id: parseInt(conversationId) },
        data: { title: updates.title },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      })
      return {
        id: updated.id.toString(),
        userId: updated.userId,
        characterId: updated.characterId.toString(),
        title: updated.title,
        messageCount: updated._count.messages,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      }
    } catch {
      return null
    }
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      await prisma.conversation.delete({ where: { id: parseInt(conversationId) } })
      return true
    } catch {
      return false
    }
  }

  // Messages
  async getMessages(userId = "default", characterId: string, conversationId?: string, limit = 50): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: {
        userId,
        characterId: parseInt(characterId),
        conversationId: conversationId ? parseInt(conversationId) : undefined,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    })
    return messages.map((m) => ({
      id: m.id.toString(),
      content: m.content,
      role: m.role as "user" | "assistant",
      characterId: m.characterId.toString(),
      conversationId: m.conversationId?.toString(),
      userId: m.userId,
      images: m.images.length > 0 ? m.images : undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
  }

  async createMessage(message: Omit<Message, "id" | "createdAt" | "updatedAt">): Promise<Message> {
    const created = await prisma.message.create({
      data: {
        content: message.content || "",
        role: message.role,
        characterId: parseInt(message.characterId),
        conversationId: message.conversationId ? parseInt(message.conversationId) : undefined,
        userId: message.userId || "default",
        images: message.images || [],
      },
    })
    
    // 更新对话的 updatedAt 时间
    if (message.conversationId) {
      await prisma.conversation.update({
        where: { id: parseInt(message.conversationId) },
        data: { updatedAt: new Date() },
      })
    }
    
    return {
      id: created.id.toString(),
      content: created.content,
      role: created.role as "user" | "assistant",
      characterId: created.characterId.toString(),
      conversationId: created.conversationId?.toString(),
      userId: created.userId,
      images: created.images.length > 0 ? created.images : undefined,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    }
  }

  async clearMessages(userId = "default", characterId: string, conversationId?: string): Promise<number> {
    const result = await prisma.message.deleteMany({
      where: {
        userId,
        characterId: parseInt(characterId),
        conversationId: conversationId ? parseInt(conversationId) : undefined,
      },
    })
    return result.count
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      await prisma.message.delete({ where: { id: parseInt(messageId) } })
      return true
    } catch {
      return false
    }
  }

  // User Settings
  async getUserSettings(userId = "default"): Promise<UserSettings> {
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    })
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId, chatBackground: "" },
      })
    }
    return {
      id: settings.id.toString(),
      userId: settings.userId,
      chatBackground: settings.chatBackground || "",
      currentCharacterId: settings.currentCharacterId?.toString(),
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    }
  }

  async updateUserSettings(userId = "default", updates: Partial<UserSettings>): Promise<UserSettings> {
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        chatBackground: updates.chatBackground,
        currentCharacterId: updates.currentCharacterId ? parseInt(updates.currentCharacterId) : null,
      },
      create: {
        userId,
        chatBackground: updates.chatBackground || "",
        currentCharacterId: updates.currentCharacterId ? parseInt(updates.currentCharacterId) : null,
      },
    })
    return {
      id: settings.id.toString(),
      userId: settings.userId,
      chatBackground: settings.chatBackground || "",
      currentCharacterId: settings.currentCharacterId?.toString(),
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    }
  }

  // Initialize with default characters if none exist
  async initializeDefaultData(userId = "default"): Promise<void> {
    const chars = await this.getCharacters(userId)
    if (chars.length === 0) {
      await this.createCharacter({
        name: "AI助手",
        avatar: "/ai-assistant-avatar.png",
        prompt:
          "你是一个友善、有帮助的AI助手。请用简洁明了的方式回答用户的问题，并尽量提供有用的建议。",
        userId,
      })
      await this.createCharacter({
        name: "编程专家",
        avatar: "/programmer-avatar.png",
        prompt:
          "你是一个经验丰富的编程专家，擅长多种编程语言和技术栈。请帮助用户解决编程问题，提供清晰的代码示例和最佳实践建议。",
        userId,
      })
    }
  }
}

export const localDB = new PrismaDB()
