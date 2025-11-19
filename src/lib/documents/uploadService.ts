import {
  uploadSupportingDocument,
  type UploadModule,
  type UploadSupportingDocResult,
  type UploadStage,
} from "@/api/finanzas";

export type DocumentUploadStage = UploadStage;
export type DocumentModule = UploadModule;

export interface DocumentUploadRequest {
  projectId: string;
  module: DocumentModule;
  file: File;
  lineItemId?: string;
  invoiceNumber?: string;
}

export interface DocumentUploadMeta extends UploadSupportingDocResult {
  uploadedAt: string;
  projectId: string;
  module: DocumentModule;
  lineItemId?: string;
}

export interface DocumentUploadCallbacks {
  onStageChange?: (stage: DocumentUploadStage, file: File) => void;
  onError?: (file: File, message: string) => void;
}

export interface DocumentUploadBatchResult {
  successes: DocumentUploadMeta[];
  failures: { file: File; message: string }[];
}

export async function uploadDocument(
  request: DocumentUploadRequest,
  callbacks?: DocumentUploadCallbacks
): Promise<DocumentUploadMeta> {
  const result = await uploadSupportingDocument(
    {
      projectId: request.projectId,
      module: request.module,
      lineItemId: request.lineItemId,
      invoiceNumber: request.invoiceNumber,
      file: request.file,
    },
    {
      onStageChange: (stage) => callbacks?.onStageChange?.(stage, request.file),
    }
  );

  return {
    ...result,
    uploadedAt: new Date().toISOString(),
    projectId: request.projectId,
    module: request.module,
    lineItemId: request.lineItemId,
  };
}

export async function uploadDocumentsBatch(
  files: File[],
  ctx: Omit<DocumentUploadRequest, "file">,
  callbacks?: DocumentUploadCallbacks
): Promise<DocumentUploadBatchResult> {
  const successes: DocumentUploadMeta[] = [];
  const failures: { file: File; message: string }[] = [];

  for (const file of files) {
    try {
      const uploaded = await uploadDocument({ ...ctx, file }, callbacks);
      successes.push(uploaded);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload document";
      failures.push({ file, message });
      callbacks?.onError?.(file, message);
    }
  }

  return { successes, failures };
}
