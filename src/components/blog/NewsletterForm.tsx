"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiMutate, toErrorMessage } from "@/lib/client-api";

type SubmitState = "idle" | "submitting" | "success" | "error";

const newsletterSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
});

type NewsletterFormValues = z.infer<typeof newsletterSchema>;

export function NewsletterForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: NewsletterFormValues) => {
    setState("submitting");
    setMessage("");

    try {
      await apiMutate("/api/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: values.email }),
      });

      setState("success");
      setMessage("订阅请求已提交，请检查邮箱完成确认。");
    } catch (error) {
      setState("error");
      setMessage(toErrorMessage(error, "订阅失败，请稍后重试。"));
    }
  };

  return (
    <form className="space-y-3" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          aria-label="邮箱地址"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          leftSlot={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          type="email"
          {...register("email")}
        />
        <Button className="h-10 whitespace-nowrap" disabled={isSubmitting} type="submit">
          {isSubmitting ? "提交中..." : "订阅"}
        </Button>
      </div>
      <AnimatePresence>
        {message ? (
          <motion.p
            key={state}
            className={`text-sm ${state === "error" ? "text-rose-500" : "text-[var(--muted)]"}`}
            role={state === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
