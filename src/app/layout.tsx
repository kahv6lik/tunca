import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import CamFiltre from "@/components/ui/CamFiltre";
import CamParlama from "@/components/ui/CamParlama";

export const metadata: Metadata = {
  title: "Gezegen CRM",
  description: "Firma, yatırım desteği, eğitim ve hizmet takip sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <Providers>
          {/*
            Cam kırılma filtresi ve parlama izleyicisi KÖK kabukta bir kez
            durur: giriş, davet ve anket gibi oturumsuz sayfalar da cam
            yüzey kullanabilsin diye (app) kabuğunda değil burada.
          */}
          <CamFiltre />
          <CamParlama />
          {children}
        </Providers>
      </body>
    </html>
  );
}
