"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import EkPaneli, { type EkBagi, type EkOzeti } from "./EkPaneli";

/**
 * Liste satırında açılıp kapanan ek bölümü (Faz 17 / A1).
 *
 * Aktivite listesinde her satırın eklerini SÜREKLİ göstermek akışı okunmaz
 * hâle getirirdi; sayı düğmenin üstünde durur, ayrıntı istendiğinde açılır.
 * Ek YOKSA ve yükleme yetkisi de yoksa düğme hiç çizilmez — boş bir ataç
 * simgesi kullanıcıya bir şey anlatmaz.
 */
export default function EkAcilir({
  bag,
  ekler,
  yukleyebilir,
  silebilir,
}: {
  bag: EkBagi;
  ekler: EkOzeti[];
  yukleyebilir: boolean;
  silebilir: boolean;
}) {
  const [acik, setAcik] = useState(false);
  if (ekler.length === 0 && !yukleyebilir) return null;

  return (
    <>
      <button
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        title="Ekler"
        className={`inline-flex items-center gap-1 text-xs ${
          ekler.length > 0 ? "text-foreground" : "text-muted-foreground"
        } hover:text-primary`}
      >
        <Paperclip className="h-4 w-4" />
        {ekler.length > 0 && ekler.length}
      </button>

      {acik && (
        <div className="mt-3 w-full basis-full rounded-xl border border-border/60 p-3">
          <EkPaneli
            bag={bag}
            ekler={ekler}
            yukleyebilir={yukleyebilir}
            silebilir={silebilir}
          />
        </div>
      )}
    </>
  );
}
