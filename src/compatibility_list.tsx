import { showModal, SimpleModal, ModalPosition, DialogButton, ScrollPanelGroup, TextField } from "@decky/ui";
import { FaSync } from "react-icons/fa";
import { useEffect, useState, ReactNode } from "react";
import { callable, toaster } from "@decky/api";

type GameEntry = {
  title: string;
  state: "supported" | "unsupported" | "informational";
  notes: string;
  link: string;
  variable_players?: string;
  short_description?: string;
};

const fetchLatestCompat = callable<[], { success: boolean; errortype: string | null }>("fetch_latest_compat");
const getCompatList = callable<[], { success: boolean; data: GameEntry[]; errortype?: string | null }>("get_compat_list");

export const showCompatibilityListModal = () => {
  showModal(<CompatibilityList />, undefined, { strTitle: "Compatibility List" });
};

const INFO_ICON = "data:image/png;base64,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";

const STATE_STYLE: Record<string, { label: ReactNode }> = {
  supported:     { label: "✅" },
  unsupported:   { label: "❌" },
  informational: { label: <img src={INFO_ICON} style={{ width: "16px", height: "16px", verticalAlign: "middle" }} /> },
};

let _expandedIndex: number | null = null;
let _searchQuery: string = "";
let _activeStates = { supported: true, unsupported: true, informational: true };

export const CompatibilityList = ({ closeModal }: { closeModal?: () => void }) => {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(_expandedIndex);
  const [searchQuery, setSearchQuery] = useState<string>(_searchQuery);
  const [activeStates, setActiveStates] = useState(_activeStates);
  const toggleState = (s: "supported" | "unsupported" | "informational") =>
    setActiveStates(prev => ({ ...prev, [s]: !prev[s] }));

  const loadList = async () => {
    setLoading(true);
    try {
      const result = await getCompatList();
      if (result.success) {
        setGames(result.data);
      } else {
        toaster.toast({ title: "Error", body: result.errortype === "filenotfound"
          ? "Compatibility list not found. Please try refreshing."
          : "Failed to load compatibility list." });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  useEffect(() => { setExpandedIndex(null); }, [searchQuery, activeStates]);

  useEffect(() => { _searchQuery = searchQuery; }, [searchQuery]);
  useEffect(() => { _activeStates = activeStates; }, [activeStates]);
  useEffect(() => { _expandedIndex = expandedIndex; }, [expandedIndex]);

  const filteredGames = games.filter(g =>
    activeStates[g.state] &&
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await fetchLatestCompat();
      if (result.success) {
        toaster.toast({ title: "Updated", body: "Compatibility list refreshed." });
        await loadList();
      } else {
        toaster.toast({ title: "Error", body: `Failed to fetch list: ${result.errortype ?? "Unknown"}` });
        setLoading(false);
      }
    } catch {
      toaster.toast({ title: "Error", body: "Failed to refresh list." });
      setLoading(false);
    }
  };

  return (
    <SimpleModal active={true}>
      <ModalPosition>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <div style={{ flex: 1 }}>
            <TextField
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              label="Search games..."
              bShowClearAction={true}
            />
          </div>
          <DialogButton
            onClick={handleRefresh}
            disabled={loading}
            style={{
              minWidth: "36px",
              width: "36px",
              height: "36px",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: loading ? 0.4 : 1,
            }}
          >
            <FaSync style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </DialogButton>
        </div>

        {}
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          {(["supported", "unsupported", "informational"] as const).map(s => (
            <DialogButton
              key={s}
              onClick={() => toggleState(s)}
              style={{
                background: activeStates[s] ? "#1a3a1a" : "#222",
                border: `1px solid ${activeStates[s] ? "#4a8a4a" : "#444"}`,
                borderRadius: "6px",
                padding: "4px 12px",
                cursor: "pointer",
                fontSize: "16px",
                opacity: activeStates[s] ? 1 : 0.35,
                transition: "all 0.15s",
              }}
            >
              {STATE_STYLE[s].label}
            </DialogButton>
          ))}
        </div>

        {}
        <ScrollPanelGroup>
          {loading ? (
            <p style={{ padding: "8px" }}>Loading...</p>
          ) : games.length === 0 ? (
            <p style={{ padding: "8px" }}>No data. Click the refresh button to fetch the list.</p>
          ) : filteredGames.length === 0 ? (
            <p style={{ padding: "8px" }}>No games match the current filter.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Game</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", width: "40px" }}>State</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((game, i) => {
                  const style = STATE_STYLE[game.state] ?? STATE_STYLE.informational;
                  const isExpanded = expandedIndex === i;
                  const hasNotes = !!game.notes;
                  return (
                    <>
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid #333", backgroundColor: "#1e1e1e", cursor: hasNotes ? "pointer" : "default" }}
                        onClick={() => hasNotes && setExpandedIndex(isExpanded ? null : i)}
                      >
                        <td style={{ padding: "6px 8px" }}>
                          <div style={{ fontWeight: "bold" }}>{game.title}</div>
                          {game.variable_players && (
                            <div style={{ fontSize: "11px", color: "#888" }}>{game.variable_players}</div>
                          )}
                          {game.short_description && (
                            <div style={{ fontSize: "11px", color: "#aaa" }}>{game.short_description}</div>
                          )}
                        </td>
                        <td style={{ textAlign: "center", padding: "6px 8px", fontWeight: "bold", fontSize: "16px" }}>
                          {style.label}
                        </td>
                      </tr>
                      {isExpanded && hasNotes && (
                        <tr key={`${i}-notes`} style={{ backgroundColor: "#1a1a1a" }}>
                          <td colSpan={2} style={{ padding: "6px 12px 10px", fontSize: "12px", color: "#ccc", whiteSpace: "pre-wrap" }}>
                            {game.notes}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollPanelGroup>

        {}
        <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end" }}>
          <DialogButton onClick={closeModal} style={{ width: "auto" }}>
            Close
          </DialogButton>
        </div>
      </ModalPosition>
    </SimpleModal>
  );
};
