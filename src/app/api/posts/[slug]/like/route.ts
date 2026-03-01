import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { slug } = await params

    const post = await prisma.post.findUnique({
      where: { slug }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: session.user.id
        }
      }
    })

    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id }
      })

      return NextResponse.json({
        success: true,
        liked: false
      })
    } else {
      await prisma.like.create({
        data: {
          postId: post.id,
          userId: session.user.id
        }
      })

      return NextResponse.json({
        success: true,
        liked: true
      })
    }
  } catch (error) {
    console.error("Like error:", error)
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

    const post = await prisma.post.findUnique({
      where: { slug }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    const likeCount = await prisma.like.count({
      where: { postId: post.id }
    })

    let isLiked = false
    if (session?.user?.id) {
      const like = await prisma.like.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: session.user.id
          }
        }
      })
      isLiked = !!like
    }

    return NextResponse.json({
      success: true,
      data: {
        count: likeCount,
        liked: isLiked
      }
    })
  } catch (error) {
    console.error("Get like status error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
