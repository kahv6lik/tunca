"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, X } from "lucide-react";
import RecordForm, { type Field } from "./RecordForm";

type ActionState = { error?: string; ok?: boolean };

export default function EditRecordDialog({
  title,
  fields,
  values,
  action,
  hidden,
}: {
  title: string;
  fields: Field[];
  values: Record<string, string | number | null | undefined>;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Kayıt değerlerini alanların defaultValue'suna işle
  const filledFields: Field[] = fields.map((f) => ({
    ...f,
    defaultValue: (values[f.name] ?? f.defaultValue ?? "") as string | number,
  }));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Düzenle"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
          <ModalKatman className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 my-8 w-full max-w-2xl rounded-2xl border border-border/70 bg-card/95 p-6 shadow-soft backdrop-blur-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <RecordForm
                action={action}
                fields={filledFields}
                hidden={hidden}
                submitLabel="Güncelle"
                onSuccess={() => setOpen(false)}
              />
            </motion.div>
          </ModalKatman>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
