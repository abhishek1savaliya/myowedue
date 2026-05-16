import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SpotlightCard from "@/components/landing/SpotlightCard";
import { landingH3, landingMuted, landingMutedSm } from "@/lib/landing-classes";
import { cn } from "@/lib/utils";

export default function LandingPricingCard({ plan, featured = false }) {
  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <SpotlightCard
      className={cn("flex h-full flex-col p-7 md:p-8", featured && "border-amber-500/30 ring-1 ring-amber-500/20")}
    >
      {featured ? (
        <Badge className="mb-4 w-fit">Most popular</Badge>
      ) : (
        <Badge variant="secondary" className="mb-4 w-fit">
          {plan.badge || "Plan"}
        </Badge>
      )}
      <h3 className={cn(landingH3, "text-2xl")}>{plan.name || "Plan"}</h3>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-4xl font-bold text-foreground">{plan.price || "$0"}</span>
        <span className="pb-1 text-sm text-zinc-500">{plan.billing || ""}</span>
      </div>
      <div
        className={cn("mt-4 text-sm leading-relaxed cms-html", landingMuted)}
        dangerouslySetInnerHTML={{ __html: plan.description || "" }}
      />
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((item, idx) => (
          <li key={idx} className={cn("flex items-start gap-2.5 text-sm", landingMutedSm)}>
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>
      <Button className="mt-8 w-full" variant={featured ? "default" : "secondary"} asChild>
        <Link href={plan.ctaHref || "/signup"}>
          {plan.ctaLabel || "Get started"}
          {featured ? <ArrowRight className="h-4 w-4" /> : null}
        </Link>
      </Button>
    </SpotlightCard>
  );
}
