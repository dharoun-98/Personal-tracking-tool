import Link from "next/link";
import { CloudOff } from "lucide-react";
import { buttonClasses } from "@/components/ui/button-styles";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto mb-6 grid size-16 place-items-center rounded-full border border-hairline bg-surface text-ink-mute">
          <CloudOff className="size-7" strokeWidth={1.5} />
        </span>
        <h1 className="font-display text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-mute text-pretty">
          Your progress is safe on this device — nothing is lost. Pages you&apos;ve
          already opened still work; the rest will come back with your connection.
        </p>
        <Link
          href="/dashboard"
          className={buttonClasses({ variant: "secondary", size: "md", className: "mt-6" })}
        >
          Back to today
        </Link>
      </div>
    </main>
  );
}
