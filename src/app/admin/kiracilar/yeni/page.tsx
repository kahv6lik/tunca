import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlatformDb } from "@/lib/platform-db";
import { PageHeader } from "@/components/layout/page-header";
import KiraciForm from "@/components/admin/KiraciForm";

export const dynamic = "force-dynamic";

export default async function YeniKiraciPage() {
  const db = await getPlatformDb();
  const planlar = await db.plan.findMany({
    orderBy: { ad: "asc" },
    select: { id: true, ad: true },
  });

  return (
    <div>
      <Link
        href="/admin/kiracilar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kuruluşlar
      </Link>

      <PageHeader
        title="Yeni Kuruluş"
        subtitle="Kuruluş oluşturulduktan sonra ilk kullanıcıyı davet edebilirsiniz."
      />

      <KiraciForm planlar={planlar} />
    </div>
  );
}
