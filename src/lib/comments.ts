import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/api-errors'

/** Hold share locks until insertion so moderation/deletion cannot pass validation mid-write. */
export async function createPublicComment(input: {
  postId: string
  content: string
  parentId?: string | null
  browserId: string
  authorLabel: string
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM posts WHERE id = ${input.postId} FOR SHARE`
    const post = await tx.post.findFirst({
      where: { id: input.postId, published: true, deletedAt: null },
      select: { id: true, slug: true, title: true },
    })
    if (!post) throw new NotFoundError('Post not found')

    if (input.parentId) {
      await tx.$queryRaw`SELECT id FROM comments WHERE id = ${input.parentId} FOR SHARE`
      const parent = await tx.comment.findFirst({
        where: { id: input.parentId, postId: post.id, deletedAt: null, status: 'APPROVED' },
        select: { id: true },
      })
      if (!parent) throw new NotFoundError('Comment not found')
    }

    const comment = await tx.comment.create({
      data: { ...input, status: 'PENDING' },
      include: { author: { select: { id: true, name: true, image: true } } },
    })
    return { post, comment }
  })
}
