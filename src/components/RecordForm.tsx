"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export type Field = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
  step?: string;
  colSpan?: 1 | 2;
  placeholder?: string;
};

type ActionState = { error?: string; ok?: boolean };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? "Kaydediliyor…" : label}
    </button>
  );
}

export default function RecordForm({
  action,
  fields,
  hidden = {},
  submitLabel = "Ekle",
  onSuccess,
  columns = 2,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  hidden?: Record<string, string>;
  submitLabel?: string;
  onSuccess?: () => void;
  columns?: 1 | 2 | 3;
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const gridCols =
    columns === 3 ? "md:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "";

  return (
    <form ref={formRef} action={formAction}>
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      <div className={`grid gap-4 ${gridCols}`}>
        {fields.map((f) => {
          const spanClass = f.colSpan === 2 ? "md:col-span-2" : "";
          return (
            <div key={f.name} className={spanClass}>
              <label className="label" htmlFor={f.name}>
                {f.label}
                {f.required ? " *" : ""}
              </label>
              {f.type === "select" ? (
                <select
                  id={f.name}
                  name={f.name}
                  className="input"
                  required={f.required}
                  defaultValue={String(f.defaultValue ?? "")}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={f.name}
                  name={f.name}
                  rows={2}
                  className="input"
                  required={f.required}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue ?? ""}
                />
              ) : (
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? "text"}
                  step={f.step}
                  className="input"
                  required={f.required}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue ?? ""}
                />
              )}
            </div>
          );
        })}
      </div>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-4">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
