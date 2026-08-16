"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { apiMutate, ApiRequestError, toErrorMessage } from "@/lib/client-api";

type TaxonomyForm = {
  id: string;
};

type SaveMessages = {
  createError: string;
  createRetryError: string;
  createSuccess: string;
  updateError: string;
  updateRetryError: string;
  updateSuccess: string;
};

type UseTaxonomyActionsOptions<Row extends { id: string }, Form extends TaxonomyForm, Payload extends object> = {
  buildCreatedRow: (data: unknown, payload: Payload) => Row;
  buildPayload: (form: Form) => Payload;
  endpoint: string;
  messages: SaveMessages;
  onSaved?: () => void | Promise<void>;
  resetForm: () => void;
  setRows: Dispatch<SetStateAction<Row[]>>;
};

/**
 * Shared create/update action for category/tag forms.
 * The caller provides payload mapping and row construction so endpoint-specific shape stays local.
 */
export function useTaxonomyActions<Row extends { id: string }, Form extends TaxonomyForm, Payload extends object>({
  buildCreatedRow,
  buildPayload,
  endpoint,
  messages,
  onSaved,
  resetForm,
  setRows,
}: UseTaxonomyActionsOptions<Row, Form, Payload>) {
  const save = useCallback(
    async (form: Form) => {
      const payload = buildPayload(form);
      const isEditing = Boolean(form.id);

      try {
        const data = await apiMutate<{ success?: boolean; data?: unknown }>(endpoint, {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(isEditing ? { id: form.id, ...payload } : payload),
        });

        if (isEditing) {
          setRows((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...payload } : item)));
        } else {
          setRows((prev) => [...prev, buildCreatedRow(data.data, payload)]);
        }

        resetForm();
        toast.success(isEditing ? messages.updateSuccess : messages.createSuccess);
        void onSaved?.();
      } catch (error) {
        toast.error(
          error instanceof ApiRequestError
            ? toErrorMessage(error, isEditing ? messages.updateError : messages.createError)
            : toErrorMessage(error, isEditing ? messages.updateRetryError : messages.createRetryError),
        );
      }
    },
    [buildCreatedRow, buildPayload, endpoint, messages, onSaved, resetForm, setRows],
  );

  return { save };
}
