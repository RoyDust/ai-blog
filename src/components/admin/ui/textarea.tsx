"use client";

import * as React from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/coss/ui/field";
import { Textarea as CossTextarea } from "@/components/coss/ui/textarea";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

function Textarea({ className, label, error, helperText, id, ...props }: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id || generatedId;

  return (
    <Field className="w-full" data-invalid={Boolean(error)} invalid={Boolean(error)}>
      {label ? <FieldLabel htmlFor={textareaId}>{label}</FieldLabel> : null}
      <CossTextarea
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-28 resize-y",
          className,
        )}
        id={textareaId}
        {...props}
      />
      {error ? (
        <FieldError match role="alert">
          {error}
        </FieldError>
      ) : null}
      {helperText && !error ? <FieldDescription>{helperText}</FieldDescription> : null}
    </Field>
  );
}

export { Textarea };
