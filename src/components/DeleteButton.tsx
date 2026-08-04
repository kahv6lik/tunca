"use client";

import { useFormStatus } from "react-dom";

function Inner({ label, confirmText }: { label: string; confirmText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : label}
    </button>
  );
}

// action: parametresiz bir server action (bind edilmiş)
export default function DeleteButton({
  action,
  label = "Sil",
  confirmText = "Bu kaydı silmek istediğinize emin misiniz?",
}: {
  action: () => Promise<void>;
  label?: string;
  confirmText?: string;
}) {
  return (
    <form action={action}>
      <Inner label={label} confirmText={confirmText} />
    </form>
  );
}
