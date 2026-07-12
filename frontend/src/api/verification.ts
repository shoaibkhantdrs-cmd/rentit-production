import { httpClient } from "./httpClient";
import { IdentityDocumentType, IdentityVerificationRecord, MyVerificationStatus } from "./types";

/** Self-service Owner Verification (Phase 4 Part 5). Admin review lives in
 * api/admin.ts instead. */
export const verificationApi = {
  submit: (documentType: IdentityDocumentType, file: File) => {
    const form = new FormData();
    form.append("documentType", documentType);
    form.append("document", file);
    return httpClient.postForm<IdentityVerificationRecord>("/verification", form);
  },

  status: () => httpClient.get<MyVerificationStatus>("/verification/status"),
};
