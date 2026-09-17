import { useCallback, useEffect, useRef, useState } from "react";
import { getJob, postJob } from "../../../shared/http/api-client";
import { CaptureMode, JobStatus, type JobState } from "../types/scan.types";

const POLL_INTERVAL_MILLISECONDS = 900;

export const useScanViewController = () => {
  const [mode, setMode] = useState<CaptureMode>(CaptureMode.PHOTO);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [knownLongestEdge, setKnownLongestEdge] = useState("100");
  const [thickness, setThickness] = useState("2");
  const [job, setJob] = useState<JobState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollHandle = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollHandle.current !== null) {
      window.clearInterval(pollHandle.current);
      pollHandle.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const onFileSelect = useCallback((file: File | null) => {
    setSelectedFile(file);
    setJob(null);
    setError(null);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
  }, []);

  const onModeChange = useCallback((nextMode: CaptureMode) => {
    setMode(nextMode);
    setSelectedFile(null);
    setJob(null);
    setError(null);
  }, []);

  const onReset = useCallback(() => {
    stopPolling();
    setSelectedFile(null);
    setJob(null);
    setError(null);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
  }, [stopPolling]);

  const onSubmit = useCallback(async () => {
    if (!selectedFile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("knownLongestEdge", knownLongestEdge);
      formData.append("thickness", thickness);
      formData.append("file", selectedFile);

      const { id } = await postJob(formData);
      setJob({ id, status: JobStatus.QUEUED, progressMessage: "Starting" });

      stopPolling();
      pollHandle.current = window.setInterval(async () => {
        try {
          const nextJob = await getJob(id);
          setJob(nextJob);
          if (nextJob.status === JobStatus.SUCCEEDED || nextJob.status === JobStatus.FAILED) {
            stopPolling();
          }
        } catch (pollError) {
          setError(pollError instanceof Error ? pollError.message : String(pollError));
          stopPolling();
        }
      }, POLL_INTERVAL_MILLISECONDS);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }, [knownLongestEdge, mode, selectedFile, stopPolling, thickness]);

  const isBusy =
    isSubmitting || job?.status === JobStatus.QUEUED || job?.status === JobStatus.RUNNING;

  return Object.freeze({
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
  });
};
