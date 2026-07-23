import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MetricsGuide } from "@/components/metrics-guide";

export const metadata: Metadata = {
  title: "Памятка по метрикам - SPB Squash Statistic",
  description: "Как читать метрики лиги: winrate, индекс формы, рейтинг силы, реализация и решающие моменты.",
};

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Памятка по метрикам" icon={BookOpen} />
      <MetricsGuide />
    </div>
  );
}
