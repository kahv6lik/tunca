"use client";

import { Printer } from "lucide-react";

/**
 * Yazdır / PDF olarak kaydet düğmesi — Faz 9 / E5.
 *
 * Tarayıcının yazdırma penceresini açar; kullanıcı oradan "PDF olarak
 * kaydet" seçer. Gerçek bir PDF üretilir, Türkçe karakterler kusursuzdur
 * ve sunucu imajına PDF kütüphanesi ya da headless tarayıcı eklemek
 * gerekmez.
 */
export default function YazdirDugmesi() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      <Printer className="h-4 w-4" /> Yazdır / PDF Kaydet
    </button>
  );
}
