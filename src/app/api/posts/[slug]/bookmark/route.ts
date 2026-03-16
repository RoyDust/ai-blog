import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkInteractionRateLimit } from "@/lib/rate-limit"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const rateLimit = await checkInteractionRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { slug } = await params

    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null, published: true }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: session.user.id
        }
      }
    })

    if (existingBookmark) {
      await prisma.bookmark.delete({
        where: { id: existingBookmark.id }
      })

      return NextResponse.json({
        success: true,
        bookmarked: false
      })
    } else {
      await prisma.bookmark.create({
        data: {
          postId: post.id,
          userId: session.user.id
        }
      })

      return NextResponse.json({
        success: true,
        bookmarked: true
      })
    }
  } catch (error) {
    console.error("Bookmark error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { slug } = await params

    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null, published: true }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    const bookmarkCount = await prisma.bookmark.count({
      where: { postId: post.id }
    })

    let isBookmarked = false
    if (session?.user?.id) {
      const bookmark = await prisma.bookmark.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: session.user.id
          }
        }
      })
      isBookmarked = !!bookmark
    }

    return NextResponse.json({
      success: true,
      data: {
        count: bookmarkCount,
        bookmarked: isBookmarked
      }
    })
  } catch (error) {
    console.error("Get bookmark status error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
