import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  staticClasses
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster
} from "@decky/api";
import { useState, useEffect } from "react";
import { FaWifi, FaSpinner, FaCog } from "react-icons/fa";
import { showWifiSettingsModal } from "./wifi_settings";

const startHotspot = callable<[], void>("start_hotspot");
const stopHotspot = callable<[], void>("stop_hotspot");
const checkDependencies = callable<[], boolean>("check_dependencies");
const updateCredentials = callable<[string, string, boolean], void>("update_credentials");

function Content() {
  const [hotspotStatus, setHotspotStatus] = useState<"start" | "loading" | "stop">("start");
  const [ssid, setSsid] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [alwaysUseStoredCredentials, setAlwaysUseStoredCredentials] = useState<boolean>(false);
  const [dependenciesOk, setDependenciesOk] = useState<boolean | null>(null);

  const generateRandomPassword = () => {
    const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
  };
  
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        // Call load_settings instead of settingsRead
        const storedConfig = await callable<[], { ssid: string; passphrase: string; always_use_stored_credentials: boolean }>("load_settings")();
        let alwaysUse = storedConfig.always_use_stored_credentials;
        let finalSsid = storedConfig.ssid;
        let finalPassphrase = storedConfig.passphrase;
  
        if (!finalSsid || !finalPassphrase || finalSsid === "undefined" || finalPassphrase === "undefined") {
          toaster.toast({ title: "Warning", body: "Stored credentials missing! Generating new credentials as failsafe." });
          finalSsid = await callable<[], string>("get_hostname")();
          finalPassphrase = generateRandomPassword();
          await updateCredentials(finalSsid, finalPassphrase, alwaysUse);
        }
  
        setSsid(finalSsid);
        setPassphrase(finalPassphrase);
        setAlwaysUseStoredCredentials(alwaysUse);
  
        const depsOk = await checkDependencies();
        setDependenciesOk(depsOk);
      } catch (error) {
        toaster.toast({ title: "Error", body: "Failed to initialize settings." });
        console.error("Failed to initialize settings:", error);
      }
    };
  
    initializeSettings();
  }, []);
  
  

  const handleClick = async () => {
    if (passphrase.length < 8 || passphrase.length > 63) {
      toaster.toast({ title: "Error", body: "Password must be between 8 and 63 characters." });
      return;
    }

    setHotspotStatus("loading");
    try {
      if (hotspotStatus === "start") {
        await startHotspot();
        setHotspotStatus("stop");
        toaster.toast({ title: "Hotspot Started", body: `SSID: ${ssid}` });
      } else {
        await stopHotspot();
        setHotspotStatus("start");
        toaster.toast({ title: "Hotspot Stopped", body: "Hotspot has been disabled." });
      }
    } catch (error) {
      toaster.toast({ title: "Error", body: "Failed to toggle hotspot." });
      setHotspotStatus(hotspotStatus === "start" ? "start" : "stop");
    }
  };

  if (dependenciesOk === false) {
    return (
      <PanelSection title="Missing Dependencies">
        <PanelSectionRow>
          <p>
            The required packages <b>dnsmasq</b> and <b>hostapd</b> are missing. Please install them by running the following commands in a terminal:
          </p>
        </PanelSectionRow>
        <PanelSectionRow>
          <code>sudo steamos-readonly disable</code>
        </PanelSectionRow>
        <PanelSectionRow>
          <code>sudo pacman -Sy --noconfirm dnsmasq hostapd</code>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Hotspot Configuration">
      <PanelSectionRow>
        <TextField label="SSID" value={ssid} disabled={true} />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField 
          label="Passphrase"
          value={passphrase} 
          disabled={true}
        />
        <ButtonItem
          layout="below"
          onClick={() =>
            showWifiSettingsModal(ssid, passphrase, alwaysUseStoredCredentials, async (newSsid, newPassphrase, alwaysUse) => {
              // Fetch updated values from Python after saving
              const updatedConfig = await callable<[string, string, boolean], { ssid: string; passphrase: string; always_use_stored_credentials: boolean }>(
                "update_credentials"
              )(newSsid, newPassphrase, alwaysUse);

              setSsid(updatedConfig.ssid);
              setPassphrase(updatedConfig.passphrase);
              setAlwaysUseStoredCredentials(updatedConfig.always_use_stored_credentials);
            })
          }
          icon={<FaCog />}
        >
          Edit WiFi Settings
        </ButtonItem>


      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleClick}
          disabled={hotspotStatus === "loading"}
          icon={hotspotStatus === "loading" ? <FaSpinner className="animate-spin" /> : <FaWifi />}
        >
          {hotspotStatus === "start" ? "Start Hotspot" : hotspotStatus === "loading" ? "Working..." : "Stop Hotspot"}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
};

export default definePlugin(() => {
  console.log("Hotspot plugin initializing");

  return {
    name: "Muon",
    titleView: <div className={staticClasses.Title}>Muon</div>,
    content: <Content />, 
    icon: <FaWifi />, 
  };
});