"use client";

import { useParams } from "next/navigation";

import { AdminPostWorkspace } from "@/components/posts/AdminPostWorkspace";

export default function AdminPostEditPage() {
  const params = useParams<{ id: string }>();

  return <AdminPostWorkspace mode="edit" postId={params.id} />;
}
