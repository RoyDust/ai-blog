"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/admin-api-client";

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
  resetForm,
  setRows,
}: UseTaxonomyActionsOptions<Row, Form, Payload>) {
  const save = useCallback(
    async (form: Form) => {
      const payload = buildPayload(form);
      const isEditing = Boolean(form.id);

      try {
        const res = await fetch(endpoint, {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEditing ? { id: form.id, ...payload } : payload),
        });
        const data = await res.json();

        if (!data.success) {
          toast.error(getApiErrorMessage(data, isEditing ? messages.updateError : messages.createError));
          return;
        }

        if (isEditing) {
          setRows((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...payload } : item)));
        } else {
          setRows((prev) => [...prev, buildCreatedRow(data.data, payload)]);
        }

        resetForm();
        toast.success(isEditing ? messages.updateSuccess : messages.createSuccess);
      } catch {
        toast.error(isEditing ? messages.updateRetryError : messages.createRetryError);
      }
    },
    [buildCreatedRow, buildPayload, endpoint, messages, resetForm, setRows],
  );

  return { save };
}
