import { Badge } from "@/components/ui/badge";
import { landingBody, landingH2 } from "@/lib/landing-classes";
import { cn } from "@/lib/utils";

export default function LandingSectionHeading({ eyebrow, title, description, className, align = "center" }) {
  return (
    <div
      className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left", className)}
    >
      <Badge variant="secondary" className="mb-4">
        {eyebrow}
      </Badge>
      <h2 className={landingH2}>{title}</h2>
      {description ? <p className={landingBody}>{description}</p> : null}
    </div>
  );
}
