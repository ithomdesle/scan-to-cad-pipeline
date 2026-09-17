import CaptureButton from "../components/CaptureButton";
import MeasurementField from "../components/MeasurementField";
import ResultPanel from "../components/ResultPanel";
import { useScanViewController } from "../controller/use-scan-view-controller";
import { CaptureMode, JobStatus } from "../types/scan.types";

const ScanView = () => {
  const {
    mode,
    selectedFile,
    previewUrl,
    knownLongestEdge,
    thickness,
    job,
    error,
    isBusy,
    onModeChange,
    onFileSelect,
    onSubmit,
    onReset,
    setKnownLongestEdge,
    setThickness,
  } = useScanViewController();

  const isPhotoMode = mode === CaptureMode.PHOTO;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[env(safe-area-inset-top)] pb-10">
      <header className="pt-6">
        <h1 className="text-2xl font-bold text-slate-100">Scan to CAD</h1>
        <p className="text-sm text-slate-400">
          Photograph a flat part, get a STEP file for Onshape.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-800 p-1">
        {[
          { value: CaptureMode.PHOTO, label: "Photo" },
          { value: CaptureMode.MESH, label: "3D scan" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onModeChange(option.value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              mode === option.value ? "bg-sky-500 text-slate-950" : "text-slate-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {job?.status === JobStatus.SUCCEEDED ? (
        <ResultPanel job={job} onReset={onReset} />
      ) : (
        <>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="The part you photographed"
              className="w-full rounded-2xl border border-slate-700 object-cover"
            />
          ) : null}

          {!selectedFile ? (
            <CaptureButton
              label={isPhotoMode ? "Take a photo" : "Choose a scan"}
              hint={
                isPhotoMode
                  ? "Lay the part flat on a contrasting surface, shoot straight down"
                  : "An STL or OBJ from Scaniverse or RealityScan"
              }
              accept={isPhotoMode ? "image/*" : ".stl,.obj"}
              isCameraCapture={isPhotoMode}
              onFileSelect={onFileSelect}
            />
          ) : (
            <p className="truncate rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-300">
              {selectedFile.name || "Captured photo"}
            </p>
          )}

          {isPhotoMode ? (
            <div className="flex flex-col gap-4">
              <MeasurementField
                label="Longest edge (mm)"
                value={knownLongestEdge}
                hint="Measure the part's longest side with calipers — this sets the scale"
                onValueChange={setKnownLongestEdge}
              />
              <MeasurementField
                label="Thickness (mm)"
                value={thickness}
                hint="Material thickness"
                onValueChange={setThickness}
              />
            </div>
          ) : null}

          <button
            type="button"
            disabled={!selectedFile || isBusy}
            onClick={onSubmit}
            className="rounded-2xl bg-sky-500 px-4 py-4 text-lg font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {isBusy ? (job?.progressMessage ?? "Working…") : "Create STEP"}
          </button>

          {selectedFile && !isBusy ? (
            <button type="button" onClick={onReset} className="text-sm text-slate-400 underline">
              Choose a different file
            </button>
          ) : null}

          {job?.status === JobStatus.FAILED ? (
            <p className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">
              {job.error}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">
              {error}
            </p>
          ) : null}
        </>
      )}
    </main>
  );
};

export default ScanView;
