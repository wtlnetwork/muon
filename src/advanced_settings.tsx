import { ModalRoot, showModal, Dropdown, TextField, Field } from "@decky/ui";
import { useState, useMemo } from "react";
import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { FaTimes, FaCheck } from "react-icons/fa";
import { callable, toaster } from "@decky/api";

// Define valid channel and hardware modes.
const VALID_CHANNELS = ["1", "6", "11", "36", "40", "44", "48"];
const VALID_HW_MODES = ["a", "b", "g"];
const DEFAULT_CHANNEL = "36";
const DEFAULT_HW_MODE = "a";
const DEFAULT_COUNTRY_CODE = "US";

export const showAdvancedSettingsModal = (
  currentChannel: string,
  currentHwMode: string,
  currentCountryCode: string,
  onSave: (channel: string, hwMode: string, countryCode: string) => void
) => {
  showModal(
    <AdvancedSettingsModal
      currentChannel={currentChannel}
      currentHwMode={currentHwMode}
      currentCountryCode={currentCountryCode}
      onSave={onSave}
    />,
    undefined,
    { strTitle: "Advanced Settings" }
  );
};

const AdvancedSettingsModal = ({
  currentChannel,
  currentHwMode,
  currentCountryCode,
  onSave,
  closeModal,
}: {
  currentChannel: string;
  currentHwMode: string;
  currentCountryCode: string;
  onSave: (channel: string, hwMode: string, countryCode: string) => void;
  closeModal?: () => void;
}) => {
  // Validate and set defaults for invalid values
  const validatedChannel = useMemo(() => 
    VALID_CHANNELS.includes(currentChannel) ? currentChannel : DEFAULT_CHANNEL,
    [currentChannel]
  );
  
  const validatedHwMode = useMemo(() => 
    VALID_HW_MODES.includes(currentHwMode) ? currentHwMode : DEFAULT_HW_MODE,
    [currentHwMode]
  );
  
  const validatedCountryCode = useMemo(() => 
    currentCountryCode && currentCountryCode !== "undefined" ? currentCountryCode : DEFAULT_COUNTRY_CODE,
    [currentCountryCode]
  );

  const [newChannel, setNewChannel] = useState(validatedChannel);
  const [newCountryCode, setNewCountryCode] = useState(validatedCountryCode);
  const [newHwMode, setNewHwMode] = useState(validatedHwMode);
  const [error, setError] = useState<string | null>(null);

  const channelOptions = useMemo(() => 
    VALID_CHANNELS.map(ch => ({ label: ch, data: ch })),
    []
  );

  const hwModeOptions = useMemo(() => 
    VALID_HW_MODES.map(mode => ({ label: mode, data: mode })),
    []
  );

  const handleSave = async () => {
    setError(null);

    try {
      const updatedAdvancedSettings = await callable<[string, string, string], { channel: string; hw_mode: string; country_code: string }>(
        "update_advanced_settings"
      )(newChannel, newHwMode, newCountryCode);
      onSave(
        updatedAdvancedSettings.channel,
        updatedAdvancedSettings.hw_mode,
        updatedAdvancedSettings.country_code
      );
      toaster.toast({ title: "Success", body: "Advanced settings updated." });
      closeModal?.();
    } catch (error) {
      setError("Could not save settings.");
      toaster.toast({ title: "Error", body: "Could not save settings." });
    }
  };

  return (
    <ModalRoot onCancel={closeModal}>
      <PanelSectionRow>
        <Field label="Channel">
          <Dropdown
            rgOptions={channelOptions}
            selectedOption={newChannel}
            onChange={(option: any) => setNewChannel(option.data)}
          />
        </Field>
      </PanelSectionRow>
      <PanelSectionRow>
        <Field label="Hardware Mode">
          <Dropdown
            rgOptions={hwModeOptions}
            selectedOption={newHwMode}
            onChange={(option: any) => setNewHwMode(option.data)}
          />
        </Field>
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField label="Country Code" value={newCountryCode} onChange={(e) => setNewCountryCode(e.target.value)} />
      </PanelSectionRow>
      {error && (
        <PanelSectionRow>
          <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem layout="inline" onClick={handleSave}>
          <FaCheck /> Save
        </ButtonItem>
        <ButtonItem layout="inline" onClick={closeModal}>
          <FaTimes /> Close
        </ButtonItem>
      </PanelSectionRow>
    </ModalRoot>
  );
};
