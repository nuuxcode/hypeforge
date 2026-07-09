import { AlertTriangle, X } from "lucide-react";

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
};

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-[8px] border-2 border-[#9f2d20] bg-[#ffe8df] p-3 text-sm font-semibold text-[#6f1d16]"
      role="alert"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      {onDismiss ? (
        <button
          aria-label="Dismiss error"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-[#ffd1c3] focus:outline-none focus:ring-2 focus:ring-[#9f2d20]"
          type="button"
          onClick={onDismiss}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
