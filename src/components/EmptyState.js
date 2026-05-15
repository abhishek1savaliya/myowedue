import { uiCardMuted } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export default function EmptyState({ text, className = "" }) {
  return (
    <div className={cn(uiCardMuted, "border-dashed p-8 text-center text-sm text-zinc-400", className)}>
      {text}
    </div>
  );
}
