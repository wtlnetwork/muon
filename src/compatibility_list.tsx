import { showModal, SimpleModal, ModalPosition, DialogButton, ScrollPanelGroup } from "@decky/ui";
import { useEffect, useState } from "react";
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

const STATE_STYLE: Record<string, { label: string }> = {
  supported:     { label: "✅" },
  unsupported:   { label: "❌" },
  informational: { label: "ℹ️" },
};

export const CompatibilityList = ({ closeModal }: { closeModal?: () => void }) => {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <DialogButton onClick={handleRefresh} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </DialogButton>
          <DialogButton onClick={closeModal}>Close</DialogButton>
        </div>
        <ScrollPanelGroup>
          {loading ? (
            <p style={{ padding: "8px" }}>Loading...</p>
          ) : games.length === 0 ? (
            <p style={{ padding: "8px" }}>No data. Click Refresh to fetch the list.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Game</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", width: "40px" }}>State</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game, i) => {
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
      </ModalPosition>
    </SimpleModal>
  );
};
