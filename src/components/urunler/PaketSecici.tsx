"use client";

import { Package } from "lucide-react";
import { type KapsamliPaket } from "@/lib/fiyat-saf";

/**
 * "Paketten kalem ekle" seçicisi — v1.25.0.
 *
 * Teklif ve sipariş formlarında AYNI bileşen kullanılır: ikisine ayrı ayrı
 * yazılsaydı, biri düzeltilirken diğeri unutulurdu (fiyat motorunun tek
 * kaynak olma gerekçesinin aynısı).
 *
 * KAMPANYA ALANINDAKİ DERSİN AYNISI (v1.23.0): liste boş olsa bile alan
 * ÇİZİLİR ve sebebini yazar. Alanı gizlemek, ortağın "paket seçemiyorum"
 * bulgusunun kaynağıydı — kullanıcı özelliğin var olduğunu bile göremiyordu.
 *
 * Seçim ANLIKTIR ve seçicide iz bırakmaz: paket bir kalem KAYNAĞIDIR,
 * belgenin bir alanı değil. Aynı paketi iki kez eklemek de meşrudur.
 */
export default function PaketSecici({
  paketler,
  firmaSecili,
  onSec,
}: {
  paketler: KapsamliPaket[];
  firmaSecili: boolean;
  onSec: (paketId: string) => void;
}) {
  if (paketler.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {firmaSecili
          ? "Bu firmaya açık aktif paket yok."
          : "Paket için önce firma seçin (genel paketler her firmada görünür)."}
      </p>
    );
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Package className="h-3.5 w-3.5" />
      <span className="sr-only">Paketten kalem ekle</span>
      <select
        aria-label="Paketten kalem ekle"
        value=""
        onChange={(e) => {
          const secilen = e.target.value;
          // Seçici boşa döner: paket bir kaynak, bir alan değil.
          e.target.value = "";
          if (secilen) onSec(secilen);
        }}
        className="input h-9 py-0 text-xs"
      >
        <option value="">Paketten kalem ekle…</option>
        {paketler.map((p) => (
          <option key={p.paketId} value={p.paketId}>
            {p.kod} — {p.ad} ({p.kalemler.length} kalem)
            {p.firmaId ? " · firmaya özel" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
