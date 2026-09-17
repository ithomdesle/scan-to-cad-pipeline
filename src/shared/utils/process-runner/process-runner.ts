import { spawn } from "node:child_process";

export type ProcessResult = {
  readonly exitCode: number;
  readonly standardOutput: string;
  readonly standardError: string;
  readonly isTimedOut: boolean;
};

export type RunProcessOptions = {
  readonly executable: string;
  readonly argumentList: readonly string[];
  readonly workingDirectory?: string;
  readonly timeoutMilliseconds: number;
};

export const runProcess = ({
  executable,
  argumentList,
  workingDirectory,
  timeoutMilliseconds,
}: RunProcessOptions): Promise<ProcessResult> =>
  new Promise((resolveResult, rejectResult) => {
    const childProcess = spawn(executable, [...argumentList], {
      cwd: workingDirectory,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let standardOutput = "";
    let standardError = "";
    let isTimedOut = false;

    const timeoutHandle = setTimeout(() => {
      isTimedOut = true;
      childProcess.kill("SIGKILL");
    }, timeoutMilliseconds);

    childProcess.stdout.on("data", (chunk: Buffer) => {
      standardOutput += chunk.toString();
    });

    childProcess.stderr.on("data", (chunk: Buffer) => {
      standardError += chunk.toString();
    });

    childProcess.on("error", (error: Error) => {
      clearTimeout(timeoutHandle);
      rejectResult(new Error(`Failed to start "${executable}": ${error.message}`));
    });

    childProcess.on("close", (exitCode: number | null) => {
      clearTimeout(timeoutHandle);
      resolveResult(
        Object.freeze({
          exitCode: exitCode ?? -1,
          standardOutput,
          standardError,
          isTimedOut,
        }),
      );
    });
  });
