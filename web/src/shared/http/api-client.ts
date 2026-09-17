import type { JobState } from "../../modules/scan/types/scan.types";

const request = async <TResponse>(path: string, requestInit?: RequestInit): Promise<TResponse> => {
  const response = await fetch(path, requestInit);

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as TResponse;
};

export const postJob = (formData: FormData) =>
  request<{ id: string }>("/api/jobs", { method: "POST", body: formData });

export const getJob = (jobId: string) => request<JobState>(`/api/jobs/${jobId}`);

export const getArtifactUrl = (jobId: string, artifact: string) =>
  `/api/jobs/${jobId}/artifacts/${artifact}`;
