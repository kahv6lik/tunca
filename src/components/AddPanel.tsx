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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">{buttonLabel}</h4>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
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
