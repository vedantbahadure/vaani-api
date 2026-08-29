import { useState, useCallback, useEffect } from "react";
import { getGoogleOAuthToken, setGoogleOAuthToken, signInWithGoogle } from "./firebase";
import { toast } from "sonner";
import { uploadDocument } from "./api";

// Google Picker & Drive Helper
export function useGoogleDrive() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(() => getGoogleOAuthToken());
  const [pickerReady, setPickerReady] = useState(false);

  useEffect(() => {
    // Keep local state in sync
    const current = getGoogleOAuthToken();
    if (current !== token) setToken(current);

    // Initialize Google API Picker script if available
    const initGapi = () => {
      if (typeof window !== "undefined" && window.gapi) {
        window.gapi.load("picker", {
          callback: () => {
            setPickerReady(true);
          },
        });
      }
    };

    if (typeof window !== "undefined" && window.gapi) {
      initGapi();
    } else {
      const interval = setInterval(() => {
        if (typeof window !== "undefined" && window.gapi) {
          clearInterval(interval);
          initGapi();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [token]);

  const ensureToken = useCallback(async () => {
    let activeToken = getGoogleOAuthToken();
    if (!activeToken) {
      toast.info("Please authorize Google Drive access...");
      await signInWithGoogle();
      activeToken = getGoogleOAuthToken();
      setToken(activeToken);
    }
    return activeToken;
  }, []);

  /**
   * Opens Google Picker modal for selecting Google Drive documents/files
   */
  const openPicker = useCallback(
    async ({ onPick, mimeTypes = null } = {}) => {
      const activeToken = await ensureToken();
      if (!activeToken) {
        toast.error("Google Drive authorization is required.");
        return;
      }

      if (typeof window === "undefined" || !window.google?.picker) {
        // Attempt load if not yet ready
        if (window.gapi) {
          window.gapi.load("picker", {
            callback: () => {
              setPickerReady(true);
              launchPicker(activeToken, onPick, mimeTypes);
            },
          });
          return;
        }
        toast.error("Google Picker API is still initializing. Please try again.");
        return;
      }

      launchPicker(activeToken, onPick, mimeTypes);
    },
    [ensureToken]
  );

  const launchPicker = (authToken, onPick, mimeTypes) => {
    try {
      const pickerOrigin =
        window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.origin;

      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
      if (mimeTypes) {
        view.setMimeTypes(mimeTypes);
      }

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .addView(new window.google.picker.DocsUploadView())
        .setOAuthToken(authToken)
        .setOrigin(pickerOrigin)
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            if (onPick) {
              await onPick(doc, authToken);
            }
          }
        })
        .build();

      picker.setVisible(true);
    } catch (err) {
      console.error("Failed to launch Google Picker:", err);
      toast.error("Could not open Google Picker: " + (err?.message || "Unknown error"));
    }
  };

  /**
   * List recent files from Google Drive
   */
  const listFiles = useCallback(
    async (queryStr = "trashed = false") => {
      const activeToken = await ensureToken();
      if (!activeToken) return [];
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          q: queryStr,
          pageSize: "25",
          fields: "files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, thumbnailLink)",
          orderBy: "modifiedTime desc",
        });
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });
        if (!res.ok) {
          if (res.status === 401) {
            setGoogleOAuthToken(null);
            setToken(null);
            throw new Error("Session expired. Please re-authorize.");
          }
          throw new Error(`Drive error ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        return data.files || [];
      } catch (err) {
        console.error("List drive files error:", err);
        toast.error("Failed to load Google Drive files: " + (err?.message || ""));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [ensureToken]
  );

  /**
   * Fetches text or blob content of a Drive file and ingests it into VAANI's RAG knowledge base
   */
  const ingestDriveFile = useCallback(
    async (file, domain = "faq", lang = "en") => {
      const activeToken = await ensureToken();
      if (!activeToken) return null;
      setLoading(true);
      try {
        let contentBlob;
        let filename = file.name || "drive_document.txt";

        if (file.mimeType === "application/vnd.google-apps.document") {
          // Export Google Doc to plain text
          const exportRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
            {
              headers: { Authorization: `Bearer ${activeToken}` },
            }
          );
          if (!exportRes.ok) throw new Error("Failed to export Google Doc");
          const text = await exportRes.text();
          contentBlob = new Blob([text], { type: "text/plain" });
          filename = filename.endsWith(".txt") ? filename : `${filename}.txt`;
        } else if (file.mimeType === "application/pdf" || file.mimeType.startsWith("text/")) {
          // Download binary or text file
          const downloadRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
            {
              headers: { Authorization: `Bearer ${activeToken}` },
            }
          );
          if (!downloadRes.ok) throw new Error("Failed to download file from Drive");
          contentBlob = await downloadRes.blob();
        } else {
          // Attempt generic export or text conversion
          const exportRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
            {
              headers: { Authorization: `Bearer ${activeToken}` },
            }
          ).catch(() => null);

          if (exportRes && exportRes.ok) {
            const text = await exportRes.text();
            contentBlob = new Blob([text], { type: "text/plain" });
          } else {
            const altRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
              {
                headers: { Authorization: `Bearer ${activeToken}` },
              }
            );
            if (!altRes.ok) throw new Error("Unsupported file format for ingestion");
            contentBlob = await altRes.blob();
          }
        }

        const uploadedFile = new File([contentBlob], filename, { type: contentBlob.type });
        const ingested = await uploadDocument(uploadedFile, domain, lang);
        toast.success(`Successfully imported "${filename}" from Google Drive into VAANI!`);
        return ingested;
      } catch (err) {
        console.error("Ingest Drive file error:", err);
        toast.error("Drive ingestion error: " + (err?.message || "Failed to process"));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [ensureToken]
  );

  /**
   * Save a note or summary file to Google Drive
   */
  const saveToDrive = useCallback(
    async (title, content, mimeType = "text/plain") => {
      const activeToken = await ensureToken();
      if (!activeToken) return null;
      setLoading(true);
      try {
        const metadata = {
          name: title.endsWith(".txt") ? title : `${title}.txt`,
          mimeType: "text/plain",
        };

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", new Blob([content], { type: mimeType }));

        const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
          body: form,
        });

        if (!res.ok) throw new Error(`Failed to save to Drive: ${res.statusText}`);
        const result = await res.json();
        toast.success(`Saved "${metadata.name}" directly to your Google Drive!`);
        return result;
      } catch (err) {
        console.error("Save to Drive error:", err);
        toast.error("Could not save to Drive: " + (err?.message || ""));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [ensureToken]
  );

  return {
    token,
    loading,
    pickerReady,
    openPicker,
    listFiles,
    ingestDriveFile,
    saveToDrive,
    ensureToken,
  };
}
