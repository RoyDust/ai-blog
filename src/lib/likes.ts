import type { Prisma } from "@prisma/client"

import { isPrismaConflictError, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

/**
 * 点赞归属身份：登录用户写 userId，匿名访客写 browserId（已 HMAC 的 actorId），
 * 两者可同时存在；读取时按 OR 匹配。
 */
export type LikeIdentity = {
  userId: string | null
  browserId: string | null
}

export type LikeState = {
  liked: boolean
  count: number
}

function toIdentityFilters(identity: LikeIdentity): Prisma.LikeWhereInput[] {
  const filters: Prisma.LikeWhereInput[] = []

  if (identity.userId) {
    filters.push({ userId: identity.userId })
  }

  if (identity.browserId) {
    filters.push({ browserId: identity.browserId })
  }

  return filters
}

/**
 * 原子化 toggle：先按身份 deleteMany，删到行即为取消；否则 create，
 * 唯一键冲突（并发请求已先写入）视为已点赞。两条语句各自原子，
 * 不依赖"先查再写"的读写间隙，因此并发双击不会产生重复行或 500。
 */
export async function toggleLike(postId: string, identity: LikeIdentity): Promise<LikeState> {
  const filters = toIdentityFilters(identity)

  if (filters.length === 0) {
    throw new ValidationError("Valid browser ID is required")
  }

  const removed = await prisma.like.deleteMany({ where: { postId, OR: filters } })
  let liked = false

  if (removed.count === 0) {
    liked = true

    try {
      await prisma.like.create({
        data: { postId, userId: identity.userId, browserId: identity.browserId },
      })
    } catch (error) {
      if (!isPrismaConflictError(error)) {
        throw error
      }
    }
  }

  const count = await prisma.like.count({ where: { postId } })

  return { liked, count }
}

export async function getLikeState(postId: string, identity: LikeIdentity): Promise<LikeState> {
  const filters = toIdentityFilters(identity)
  const count = await prisma.like.count({ where: { postId } })

  if (filters.length === 0) {
    return { liked: false, count }
  }

  const existing = await prisma.like.findFirst({
    where: { postId, OR: filters },
    select: { id: true },
  })

  return { liked: existing !== null, count }
}
