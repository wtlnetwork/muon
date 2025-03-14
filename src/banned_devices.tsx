import { ModalRoot, showModal } from "@decky/ui";
import { useEffect, useState } from "react";
import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { FaTrash, FaTimes } from "react-icons/fa";
import { callable, toaster } from "@decky/api";

// Function to show the banned devices modal
export const showBannedDevicesModal = () => {
  showModal(<BannedDevicesModal />, undefined, { strTitle: "Banned Devices" });
};

// Main modal component
const BannedDevicesModal = ({ closeModal }: { closeModal?: () => void }) => {
  const [bannedDevices, setBannedDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const retrieveBanList = callable<[], string[]>("retrieve_ban_list");
  const unbanMacAddress = callable<[string], boolean>("unban_mac_address");

  // Fetch banned MAC addresses
  useEffect(() => {
    const fetchBannedDevices = async () => {
      try {
        const result = await retrieveBanList();
        setBannedDevices(result);
      } catch (error) {
        toaster.toast({ title: "Error", body: "Failed to retrieve banned devices." });
      } finally {
        setLoading(false);
      }
    };

    fetchBannedDevices();
  }, []);

  // Handle unban action
  const handleUnban = async (mac: string) => {
    const success = await unbanMacAddress(mac);
    if (success) {
      toaster.toast({ title: "Success", body: `Unbanned ${mac}` });
      setBannedDevices((prev) => prev.filter((item) => item !== mac));
    } else {
      toaster.toast({ title: "Error", body: `Failed to unban ${mac}` });
    }
  };

  return (
    <ModalRoot>
      {loading ? (
        <p>Loading banned devices...</p>
      ) : bannedDevices.length > 0 ? (
        bannedDevices.map((mac) => (
          <PanelSectionRow key={mac}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>{mac}</span>
              <ButtonItem layout="inline" onClick={() => handleUnban(mac)}>
                <FaTrash color="red" /> Unban
              </ButtonItem>
            </div>
          </PanelSectionRow>
        ))
      ) : (
        <p>No banned devices found.</p>
      )}

      {/* Close button at the bottom */}
      <PanelSectionRow>
        <ButtonItem layout="inline" onClick={closeModal}>
          <FaTimes /> Close
        </ButtonItem>
      </PanelSectionRow>
    </ModalRoot>
  );
};