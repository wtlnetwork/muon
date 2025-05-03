import { Field, ModalRoot, showModal, Toggle } from "@decky/ui";
import { useState } from "react";
import { ButtonItem, PanelSectionRow, TextField } from "@decky/ui";
import { FaCheck, FaTimes, FaBan } from "react-icons/fa";
import { callable, toaster } from "@decky/api";
import { showBannedDevicesModal } from "./banned_devices";
import { SubnetDhcpInput } from "./components/SubnetDhcpInput";

export const showWifiSettingsModal = (
  currentSsid: string,
  currentPassphrase: string,
  alwaysUseStoredCredentials: boolean,
  currentBaseIp: string,
  currentDhcpStart: string,
  currentDhcpEnd: string,
  onSave: (ssid: string, passphrase: string, alwaysUse: boolean, ip: string, dhcpStart: string, dhcpEnd: string) => void
) => {
  showModal(
    <WifiSettingsModal
      currentSsid={currentSsid}
      currentPassphrase={currentPassphrase}
      alwaysUseStoredCredentials={alwaysUseStoredCredentials}
      currentBaseIp={currentBaseIp}
      currentDhcpStart={currentDhcpStart}
      currentDhcpEnd={currentDhcpEnd}
      onSave={onSave}
    />,
    undefined,
    { strTitle: "Edit WiFi Settings" }
  );
};

const WifiSettingsModal = ({
  currentSsid,
  currentPassphrase,
  alwaysUseStoredCredentials,
  currentBaseIp,
  currentDhcpStart,
  currentDhcpEnd,
  onSave,
  closeModal,
}: {
  currentSsid: string;
  currentPassphrase: string;
  alwaysUseStoredCredentials: boolean;
  currentBaseIp: string;
  currentDhcpStart: string;
  currentDhcpEnd: string;
  onSave: (ssid: string, passphrase: string, alwaysUse: boolean, ip: string, dhcpStart: string, dhcpEnd: string) => void
  closeModal?: () => void;
}) => {
  const [newSsid, setNewSsid] = useState(currentSsid);
  const [newPassphrase, setNewPassphrase] = useState(currentPassphrase);
  const [alwaysUse, setAlwaysUse] = useState(alwaysUseStoredCredentials);
  const [error, setError] = useState<string | null>(null);
  const [baseIp, setBaseIp] = useState(currentBaseIp);
  const [dhcpStart, setDhcpStart] = useState(currentDhcpStart);
  const [dhcpEnd, setDhcpEnd] = useState(currentDhcpEnd);

  const handleSave = async () => {
    if (newPassphrase.length < 8 || newPassphrase.length > 63) {
      setError("Password must be between 8 and 63 characters.");
      return;
    }
  
    setError(null); // Clear previous errors if any
  
    try {
      // Call update_credentials and get the updated values
      const updatedConfig = await callable<[string, string, boolean], { ssid: string; passphrase: string; always_use_stored_credentials: boolean }>(
        "update_credentials"
      )(newSsid, newPassphrase, alwaysUse);
      const updateDhcp = callable<[string, string, string], { ip_address: string; dhcp_range: string }>("update_dhcp");
      await updateDhcp(baseIp, dhcpStart, dhcpEnd);
      // Update UI with the latest values
      onSave(
        updatedConfig.ssid,
        updatedConfig.passphrase,
        updatedConfig.always_use_stored_credentials,
        baseIp,
        dhcpStart,
        dhcpEnd
      );
      closeModal?.();
    } catch (error) {
      setError("Could not save settings.");
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
      <PanelSectionRow>
        <Field
            label="Always use these credentials"
        >
          <Toggle
            value={alwaysUse}
            onChange={(toggleValue) => setAlwaysUse(toggleValue)}
          />
        </Field>
      </PanelSectionRow>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <PanelSectionRow>
        <SubnetDhcpInput
          baseIp={baseIp}
          error={error || undefined}
          onChange={(ip, start, end) => {
            setBaseIp(ip);
            setDhcpStart(start);
            setDhcpEnd(end);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="inline" onClick={showBannedDevicesModal}>
          <FaBan /> Manage Banned Devices
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="inline" onClick={handleSave}>
          <FaCheck /> Save
        </ButtonItem>
        <ButtonItem layout="inline" onClick={closeModal}>
          <FaTimes /> Cancel
        </ButtonItem>
      </PanelSectionRow>
    </ModalRoot>
  );
};
