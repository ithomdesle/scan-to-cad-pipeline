import { createEnum, type EnumValues } from "../../../shared/types/enum.types.js";

export const StepSchema = createEnum({
  AP214: "ap214",
  AP242: "ap242",
});
export type StepSchema = EnumValues<typeof StepSchema>;

export type StepExportOptions = {
  readonly pythonExecutable?: string;
  readonly schema: StepSchema;
  readonly timeoutMilliseconds: number;
};

export type StepExportResult = {
  readonly isSuccess: boolean;
  readonly stepFilePath?: string;
  readonly volume?: number;
  readonly appliedSchema?: string;
  readonly error?: string;
};
