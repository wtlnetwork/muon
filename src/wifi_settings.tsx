import { ModalRoot, showModal } from "@decky/ui";
import { useState } from "react";
import { ButtonItem, PanelSectionRow, TextField } from "@decky/ui";
import { FaCheck, FaTimes } from "react-icons/fa";
import { callable, toaster } from "@decky/api";

const settingsSet = callable<[key: string, value: string], boolean>("settings_setSetting");
const settingsCommit = callable<[], boolean>("settings_commit");

export const showWifiSettingsModal = (
  currentSsid: string,
  currentPassphrase: string,
  onSave: (ssid: string, passphrase: string) => void
) => {
  showModal(
    <WifiSettingsModal
      currentSsid={currentSsid}
      currentPassphrase={currentPassphrase}
      onSave={onSave}
    />,
    undefined,
    { strTitle: "Edit WiFi Settings" }
  );
};

const WifiSettingsModal = ({
  currentSsid,
  currentPassphrase,
  onSave,
  closeModal,
}: {
  currentSsid: string;
  currentPassphrase: string;
  onSave: (ssid: string, passphrase: string) => void;
  closeModal?: () => void;
}) => {
  const [newSsid, setNewSsid] = useState(currentSsid);
  const [newPassphrase, setNewPassphrase] = useState(currentPassphrase);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (newPassphrase.length < 8 || newPassphrase.length > 63) {
      setError("Password must be between 8 and 63 characters.");
      return;
    }

    try {
      await settingsSet("ssid", newSsid);
      await settingsSet("passphrase", newPassphrase);
      const success = await settingsCommit();

      if (success) {
        toaster.toast({ title: "Settings Saved", body: "SSID and Passphrase updated successfully." });
        onSave(newSsid, newPassphrase);
        closeModal?.();
      } else {
        toaster.toast({ title: "Error", body: "Failed to save settings." });
      }
    } catch (error) {
      toaster.toast({ title: "Error", body: "Could not save settings." });
    }
  };

  return (
    <ModalRoot>
      <PanelSectionRow>
        <TextField label="SSID" value={newSsid} onChange={(e) => setNewSsid(e.target.value)} />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Passphrase"
          value={newPassphrase}
          onChange={(e) => setNewPassphrase(e.target.value)}
        />
      </PanelSectionRow>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleSave} icon={<FaCheck />}>
          Save
        </ButtonItem>
        <ButtonItem layout="below" onClick={closeModal} icon={<FaTimes />}>
          Cancel
        </ButtonItem>
      </PanelSectionRow>
    </ModalRoot>
  );
};
