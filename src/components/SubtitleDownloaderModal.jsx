import { useState } from "react";

export default function SubtitleDownloaderModal({
  dl,
  onClose,
  onOpenSettings,
  onSubtitlesSaved,
  onSubtitleDeleted,
}) {
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({});
  const [currentSubs, setCurrentSubs] = useState(dl?.subtitlePaths || []);

  const getKeys = async () => {
    if (!window.electron?.secureGet) return { subdlApiKey: "", wyzieApiKey: "" };
    const [subdlApiKey, wyzieApiKey] = await Promise.all([
      window.electron.secureGet("subdlApiKey"),
      window.electron.secureGet("wyzieApiKey"),
    ]);
    return {
      subdlApiKey: subdlApiKey || "",
      wyzieApiKey: wyzieApiKey || "",
    };
  };

  const handleSearch = async () => {
    if (!window.electron?.searchSubtitles) {
      setError("Subtitle search is unavailable in this build.");
      return;
    }
    if (!dl?.tmdbId) {
      setError("This download does not have a TMDB id.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const keys = await getKeys();
      const res = await window.electron.searchSubtitles({
        tmdbId: dl.tmdbId,
        mediaType: dl.mediaType || "movie",
        season: dl.season ?? null,
        episode: dl.episode ?? null,
        languages: language.trim() || "en",
        ...keys,
      });

      if (res?.ok) {
        setResults(res.results || []);
        setSelected({});
      } else {
        setResults([]);
        setError(res?.error || "No subtitles found.");
      }
    } catch (err) {
      setError(err.message || "Subtitle search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!window.electron?.downloadSubtitlesForFile) {
      setError("Subtitle download is unavailable in this build.");
      return;
    }
    const chosen = results.filter((result) => selected[result.file_id]);
    if (!chosen.length) {
      setError("Select at least one subtitle to download.");
      return;
    }
    if (!dl?.filePath) {
      setError("The media file is missing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await window.electron.downloadSubtitlesForFile({
        filePath: dl.filePath,
        selectedSubs: chosen,
      });
      if (res?.ok) {
        const saved = res.subtitlePaths || [];
        setCurrentSubs((prev) => [...prev, ...saved]);
        onSubtitlesSaved?.(saved);
      } else {
        setError(res?.error || "Subtitle download failed.");
      }
    } catch (err) {
      setError(err.message || "Subtitle download failed.");
    } finally {
      setSaving(false);
    }
  };

  const removeSubtitle = async (entry) => {
    if (entry?.path && window.electron?.deleteSubtitleFile) {
      await window.electron.deleteSubtitleFile({
        downloadId: dl?.id,
        subtitlePath: entry.path,
      });
    }
    setCurrentSubs((prev) => prev.filter((item) => item.path !== entry.path));
    onSubtitleDeleted?.(entry.path);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 860,
          maxHeight: "88vh",
          overflow: "auto",
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
              Subtitle Downloader
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{dl?.name}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onOpenSettings && (
              <button
                onClick={() => {
                  onOpenSettings();
                  onClose?.();
                }}
                style={{
                  background: "var(--bg3)",
                  color: "var(--text)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                Settings
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "var(--bg3)",
                color: "var(--text2)",
                width: 34,
                height: 34,
                borderRadius: 999,
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Language code, e.g. en"
            />
            <button onClick={handleSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
            <button onClick={handleDownload} disabled={saving || !results.length}>
              {saving ? "Saving..." : "Download selected"}
            </button>
          </section>

          {error && (
            <div
              style={{
                background: "rgba(225,29,72,0.1)",
                border: "1px solid rgba(225,29,72,0.2)",
                color: "#fca5a5",
                borderRadius: 10,
                padding: 12,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <section>
            <h3 style={{ marginBottom: 10, fontSize: 16 }}>Current subtitles</h3>
            {currentSubs.length === 0 ? (
              <div style={{ color: "var(--text2)", fontSize: 13 }}>
                No subtitles have been saved for this file yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {currentSubs.map((entry) => (
                  <div
                    key={entry.path}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: 10,
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{entry.lang?.toUpperCase() || "SUB"}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>{entry.path}</div>
                    </div>
                    <button onClick={() => removeSubtitle(entry)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 style={{ marginBottom: 10, fontSize: 16 }}>Search results</h3>
            {results.length === 0 ? (
              <div style={{ color: "var(--text2)", fontSize: 13 }}>
                Search for subtitles to populate this list.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {results.map((result) => {
                  const checked = !!selected[result.file_id];
                  return (
                    <button
                      key={result.file_id}
                      onClick={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [result.file_id]: !prev[result.file_id],
                        }))
                      }
                      style={{
                        textAlign: "left",
                        background: checked ? "rgba(225,29,72,0.16)" : "var(--bg3)",
                        color: "var(--text)",
                        border: `1px solid ${checked ? "rgba(225,29,72,0.35)" : "var(--border)"}`,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 700 }}>{result.file_name || result.release || result.file_id}</div>
                        <div style={{ color: "var(--text2)", fontSize: 12 }}>
                          {checked ? "Selected" : result.language?.toUpperCase() || "SUB"}
                        </div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--text2)" }}>
                        {result.uploader || "Community"}
                        {result.hearing_impaired ? " · HI" : ""}
                        {result.ai_translated ? " · AI" : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}