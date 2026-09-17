type CaptureButtonProps = {
  readonly label: string;
  readonly hint: string;
  readonly accept: string;
  readonly isCameraCapture: boolean;
  readonly onFileSelect: (file: File | null) => void;
};

const CaptureButton = ({
  label,
  hint,
  accept,
  isCameraCapture,
  onFileSelect,
}: CaptureButtonProps) => (
  <label className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800/60 px-4 py-8 text-center active:bg-slate-700">
    <span className="text-lg font-semibold text-slate-100">{label}</span>
    <span className="text-sm text-slate-400">{hint}</span>
    <input
      type="file"
      accept={accept}
      {...(isCameraCapture ? { capture: "environment" as const } : {})}
      className="hidden"
      onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
    />
  </label>
);

export default CaptureButton;
