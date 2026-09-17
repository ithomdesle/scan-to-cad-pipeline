import { getArtifactUrl } from "../../../shared/http/api-client";
import type { JobState } from "../types/scan.types";

type ResultPanelProps = {
  readonly job: JobState;
  readonly onReset: () => void;
};

const ResultPanel = ({ job, onReset }: ResultPanelProps) => (
  <div className="flex flex-col gap-4">
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 p-4">
      <p className="text-lg font-semibold text-emerald-300">Solid created</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-300">
        {job.featureSummary?.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {job.measurements ? (
          <li>{job.measurements.volumeInCubicMillimetres.toFixed(1)} mm³ of material</li>
        ) : null}
      </ul>
    </div>

    <a
      href={getArtifactUrl(job.id, "step")}
      className="rounded-2xl bg-sky-500 px-4 py-4 text-center text-lg font-semibold text-slate-950 active:bg-sky-400"
    >
      Download STEP
    </a>

    <div className="grid grid-cols-2 gap-3">
      <a
        href={getArtifactUrl(job.id, "model")}
        className="rounded-xl border border-slate-600 px-4 py-3 text-center text-sm text-slate-300"
      >
        Model source
      </a>
      <button
        type="button"
        onClick={onReset}
        className="rounded-xl border border-slate-600 px-4 py-3 text-center text-sm text-slate-300"
      >
        Start over
      </button>
    </div>
  </div>
);

export default ResultPanel;
