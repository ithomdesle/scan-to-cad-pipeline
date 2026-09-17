type MeasurementFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly onValueChange: (value: string) => void;
};

const MeasurementField = ({ label, value, hint, onValueChange }: MeasurementFieldProps) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm font-medium text-slate-300">{label}</span>
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-lg text-slate-100 outline-none focus:border-sky-400"
    />
    <span className="text-xs text-slate-500">{hint}</span>
  </label>
);

export default MeasurementField;
