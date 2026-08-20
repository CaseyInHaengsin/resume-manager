import { useRef } from "react";

type ConfirmButtonProps = {
  children: React.ReactNode;
  formId: string;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
};

export function ConfirmButton({
  children,
  formId,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  className,
}: ConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto rounded-lg p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="p-6 space-y-4 min-w-[320px] max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {message && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => dialogRef.current?.close()}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              form={formId}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => dialogRef.current?.close()}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
