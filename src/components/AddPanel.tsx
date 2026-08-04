"use client";

import { useState } from "react";
import RecordForm, { type Field } from "./RecordForm";

type ActionState = { error?: string; ok?: boolean };

export default function AddPanel({
  buttonLabel,
  action,
  fields,
  hidden,
  submitLabel = "Ekle",
  columns = 2,
}: {
  buttonLabel: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  hidden?: Record<string, string>;
  submitLabel?: string;
  columns?: 1 | 2 | 3;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm">
        + {buttonLabel}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground/90">{buttonLabel}</h4>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-muted-foreground hover:text-foreground/90"
        >
          Kapat ✕
        </button>
      </div>
      <RecordForm
        action={action}
        fields={fields}
        hidden={hidden}
        submitLabel={submitLabel}
        columns={columns}
        onSuccess={() => setOpen(false)}
      />
    </div>
  );
}
