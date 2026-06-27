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

const STATE_STYLE: Record<string, { label: ReactNode }> = {
  supported:     { label: "✅" },
  unsupported:   { label: "❌" },
  informational: { label: <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#1a6bb5", color: "white", fontSize: "11px", fontWeight: "bold", fontStyle: "italic", lineHeight: 1 }}>i</span> },
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
