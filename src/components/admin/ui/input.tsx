import * as React from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/shadcn/ui/field";
import { Input as ShadcnInput } from "@/components/shadcn/ui/input";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rightSlot?: React.ReactNode;
}

const inputClassName = "";

function Input({ className, label, error, helperText, rightSlot, id, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <Field data-invalid={Boolean(error)}>
      {label ? <FieldLabel htmlFor={inputId}>{label}</FieldLabel> : null}
      <div className={rightSlot ? "relative" : undefined}>
        <ShadcnInput
          aria-invalid={Boolean(error)}
          className={cn(
            rightSlot ? "pr-12" : "",
            className,
          )}
          id={inputId}
          {...props}
        />
        {rightSlot ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div> : null}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      {helperText && !error ? <FieldDescription>{helperText}</FieldDescription> : null}
    </Field>
  );
}

export { Input, inputClassName };
