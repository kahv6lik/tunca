"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modal kaplaması — içerik React portalıyla document.body'ye taşınır.
 *
 * Neden portal: `.card` sınıfı `backdrop-blur` kullanır ve backdrop-filter,
 * `position: fixed` torunlar için kapsayıcı blok oluşturur. Kartın İÇİNDEN
 * render edilen bir modal ekrana değil karta göre konumlanır ve "kutunun
 * içinde sıkışmış" görünür. Portal, modalı DOM'da kartın dışına çıkararak
 * bu sınıfı sorunun tamamını kapatır.
 */
export default function ModalKatman({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const [hazir, setHazir] = useState(false);
  useEffect(() => setHazir(true), []);
  if (!hazir) return null;

  return createPortal(<div {...props}>{children}</div>, document.body);
}
