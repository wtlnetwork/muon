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
  toaster,
  call
} from "@decky/api";
import { useState, useEffect } from "react";
import { FaWifi, FaSpinner, FaCog } from "react-icons/fa";
import { showWifiSettingsModal } from "./wifi_settings";
import { getSignalIcon } from "./signalIcons";

const startHotspot = callable<[], void>("start_hotspot");
const stopHotspot = callable<[], void>("stop_hotspot");
const checkDependencies = callable<[], Record<string, boolean>>("check_dependencies");
const isHotspotActive = callable<[], boolean>("is_hotspot_active");
const updateCredentials = callable<[string, string, boolean], void>("update_credentials");
const installDependencies = callable<[boolean, boolean], { success: boolean; error?: string }>("install_dependencies");
const getConnectedDevices = callable<[], any>("get_connected_devices");


declare global {
  interface Window {
    SteamClient: any;
  }
}

function Content() {
  const [hotspotStatus, setHotspotStatus] = useState<"start" | "loading" | "stop">("start");
  const [ssid, setSsid] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [alwaysUseStoredCredentials, setAlwaysUseStoredCredentials] = useState<boolean>(false);
  const [dependencies, setDependencies] = useState<Record<string, boolean> | null>(null);
  const [installingDependencies, setInstallingDependencies] = useState(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);

  const generateRandomPassword = () => {
    const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
  };
  
  useEffect(() => {
    const initializeSettings = async () => {
      try {
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
  
        // Fetch dependencies when the effect runs
        const deps = await checkDependencies();
        setDependencies(deps);
  
        const hotspotActive = await isHotspotActive();
        setHotspotStatus(hotspotActive ? "stop" : "start");

        const rfkillBlocked = await callable<[], boolean>("is_rfkill_blocking_wlan")();
        setIsBlocked(rfkillBlocked);

      } catch (error) {
        toaster.toast({ title: "Error", body: "Failed to initialize settings." });
        console.error("Failed to initialize settings:", error);
      }
    };
  
    initializeSettings();
  }, []);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await getConnectedDevices();
        console.log("Connected Devices Response:", devices);
    
        // If devices is a JSON string, parse it
        const parsedDevices = typeof devices === "string" ? JSON.parse(devices) : devices;
    
        // Ensure it's an array before setting state
        setConnectedDevices(Array.isArray(parsedDevices) ? parsedDevices : []);
      } catch (error) {
        console.error("Failed to fetch connected devices:", error);
        setConnectedDevices([]); // Set to empty array on error
      }
    };
  
    // Poll every 5 seconds when hotspot is running
    if (hotspotStatus === "stop") {
      fetchDevices(); // Fetch immediately when hotspot starts
  
      const interval = setInterval(() => {
        fetchDevices();
      }, 5000); // Poll every 5 seconds
  
      return () => clearInterval(interval);
    }
  
    // Explicitly return undefined when not polling
    return undefined;
  }, [hotspotStatus]);
  
  
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
    } finally {
      // Ensure we check the current status before re-enabling the button
      const hotspotActive = await isHotspotActive();
      setHotspotStatus(hotspotActive ? "stop" : "start");
    }
  };
  
  if (dependencies && (!dependencies["dnsmasq"] || !dependencies["hostapd"])) {
    const missingDnsmasq = !dependencies["dnsmasq"];
    const missingHostapd = !dependencies["hostapd"];
  
    return (
      <PanelSection title="Missing Dependencies">
        <PanelSectionRow>
          <p>
            The following required packages are missing:
            {missingDnsmasq && <b> dnsmasq</b>}
            {missingHostapd && <b> hostapd</b>}
            . You can install them automatically:
          </p>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="inline"
            disabled={installingDependencies}
            onClick={async () => {
              setInstallingDependencies(true);
              toaster.toast({ title: "Installing Dependencies", body: "Please wait..." });
  
              const result = await installDependencies(missingDnsmasq, missingHostapd);
              if (result.success) {
                toaster.toast({ title: "Success", body: "Dependencies installed successfully!" });
  
                const updatedDeps = await checkDependencies();
                setDependencies(updatedDeps);
  
                const hotspotActive = await isHotspotActive();
                setHotspotStatus(hotspotActive ? "stop" : "start");
              } else {
                toaster.toast({ title: "Error", body: `Failed to install: ${result.error}` });
              }
  
              setInstallingDependencies(false);
            }}
          >
            {installingDependencies ? (
              <>
                <FaSpinner className="animate-spin" /> Installing...
              </>
            ) : (
              "Install Missing Dependencies"
            )}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    );
  }  
  
  return (
    <>
      {/* Hotspot Control Section */}
      <PanelSection title="Hotspot Control">
        <PanelSectionRow>
          <ButtonItem
            layout="inline"
            onClick={handleClick}
            disabled={hotspotStatus === "loading" || isBlocked}
          >
            {hotspotStatus === "loading" ? (
              <>
                <FaSpinner className="animate-spin" /> Working...
              </>
            ) : hotspotStatus === "start" ? (
              <>
                <FaWifi /> Start Hotspot
              </>
            ) : (
              <>
                <FaWifi /> Stop Hotspot
              </>
            )}
          </ButtonItem>
        </PanelSectionRow>
  
        {isBlocked && (
          <PanelSectionRow>
            <p style={{ color: "red" }}>⚠ Please enable WiFi to use the hotspot.</p>
          </PanelSectionRow>
        )}
      </PanelSection>
  
      {/* Connected Devices Section */}
      {hotspotStatus === "stop" && (
        <PanelSection title="Connected Devices">
          {Array.isArray(connectedDevices) && connectedDevices.length > 0 ? (
            connectedDevices.map((device, index) => (
              <PanelSectionRow key={index}>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div style={{ width: "50px", height: "50px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    {getSignalIcon(device.signal_strength, 32)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>{device.hostname}</div>
                    <div style={{ fontSize: "12px", color: "#888" }}>{device.ip}</div>
                  </div>
                </div>
              </PanelSectionRow>
            ))
          ) : (
            <PanelSectionRow>
              <p>No devices connected.</p>
            </PanelSectionRow>
          )}
        </PanelSection>
      )}
  
      {/* SSID/Passphrase and Settings Section */}
      <PanelSection title="Network Settings">
        <PanelSectionRow>
          <TextField label="SSID" value={ssid} disabled={true} />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField label="Passphrase" value={passphrase} disabled={true} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="inline"
            onClick={() =>
              showWifiSettingsModal(
                ssid,
                passphrase,
                alwaysUseStoredCredentials,
                async (newSsid, newPassphrase, alwaysUse) => {
                  // Fetch updated values from Python after saving
                  const updatedConfig = await callable<
                    [string, string, boolean],
                    { ssid: string; passphrase: string; always_use_stored_credentials: boolean }
                  >("update_credentials")(newSsid, newPassphrase, alwaysUse);
  
                  setSsid(updatedConfig.ssid);
                  setPassphrase(updatedConfig.passphrase);
                  setAlwaysUseStoredCredentials(updatedConfig.always_use_stored_credentials);
                }
              )
            }
          >
            <FaCog /> Edit WiFi Settings
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
};

export default definePlugin(() => {
  console.log("Hotspot plugin initializing");

  const suspendRequestRegistration = window.SteamClient.System.RegisterForOnSuspendRequest(() => {
    call<[]>("suspend_ap")
  });
  const suspendResumeRegistration = window.SteamClient.System.RegisterForOnResumeFromSuspend(() => {
    call<[]>("resume_ap")
  });

  return {
    name: "Muon",
    titleView: <div className={staticClasses.Title}>Muon</div>,
    content: <Content />, 
    icon: <FaWifi />, 
    onDismount() {
      suspendRequestRegistration.unregister();
      suspendResumeRegistration.unregister();
    }
  };
});