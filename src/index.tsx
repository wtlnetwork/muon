import {
  ButtonItem,
  DialogButton,
  Focusable,
  PanelSection,
  PanelSectionRow,
  TextField,
  staticClasses,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
  call,
  addEventListener,
  removeEventListener
} from "@decky/api";
import { useState, useEffect } from "react";
import { FaWifi, FaSpinner, FaCog } from "react-icons/fa";
import { showWifiSettingsModal } from "./wifi_settings";
import { getSignalIcon } from "./signalIcons";
import { BootIcon } from "./banned_devices";
import { sleepManager } from "./lib/SleepManager";

const startHotspot = callable<[], void>("start_hotspot");
const stopHotspot = callable<[], void>("stop_hotspot");
const checkDependencies = callable<[], Record<string, boolean>>("check_dependencies");
const isHotspotActive = callable<[], boolean>("is_hotspot_active");
const updateCredentials = callable<[string, string, boolean], void>("update_credentials");
const installDependencies = callable<[], { success: boolean; error?: string }>("install_dependencies");
const getConnectedDevices = callable<[], any>("get_connected_devices");
const kickMac = callable<[string], boolean>("kick_mac");
const getIpAddress = callable<[], string>("get_ip_address");

let _muonListenerRegistered = false;

declare global {
  interface Window {
    SteamClient: any;
  }
}

function Content() {
  const [hotspotStatus, setHotspotStatus] = useState<"running" | "loading" | "stopped">("stopped");
  const [ssid, setSsid] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [alwaysUseStoredCredentials, setAlwaysUseStoredCredentials] = useState<boolean>(false);
  const [baseIp, setBaseIp] = useState("192.168.8.1");
  const [dhcpStart, setDhcpStart] = useState("192.168.8.100");
  const [dhcpEnd, setDhcpEnd] = useState("192.168.8.200");
  const [dependencies, setDependencies] = useState<Record<string, boolean> | null>(null);
  const [installingDependencies, setInstallingDependencies] = useState(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);
  const [ipAddress, setIpAddress] = useState<string>("");

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const ip = await getIpAddress();
        setIpAddress(ip);
      } catch (err) {
        console.error("Failed to fetch IP address", err);
        setIpAddress("Unknown");
      }
    };
    fetchIp();
  }, []);

  const generateRandomPassword = () => {
    const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
  };

  const handleKickDevice = async (mac: string) => {
    const success = await kickMac(mac);
    if (success) {
      toaster.toast({ title: "Device Kicked", body: `Successfully kicked ${mac}` });
    } else {
      toaster.toast({ title: "Error", body: `Failed to kick ${mac}` });
    }
  };
  
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const storedConfig = await callable<[], {
          ssid: string;
          passphrase: string;
          always_use_stored_credentials: boolean;
          ip_address: string;
          dhcp_range: string;
        }>("load_settings")();
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
        setBaseIp(storedConfig.ip_address);
        const [start, end] = storedConfig.dhcp_range.split(",").slice(0, 2);
        setDhcpStart(start);
        setDhcpEnd(end);
  
        const deps = await checkDependencies();
        setDependencies(deps);
  
        const hotspotActive = await isHotspotActive();
        setHotspotStatus(hotspotActive ? "running" : "stopped");

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
    const needsInstall =
      dependencies && (!dependencies["dnsmasq"] || !dependencies["hostapd"]);

    if (needsInstall && !installingDependencies) {
      (async () => {
        try {
          setInstallingDependencies(true);
          toaster.toast({ title: "Installing dependencies", body: "Please wait..." });

          const result = await installDependencies();
          if (result.success) {
            toaster.toast({ title: "Success", body: "Dependencies installed successfully!" });

            await new Promise(r => setTimeout(r, 1500));

            const updatedDeps = await checkDependencies();
            setDependencies(updatedDeps);

            const hotspotActive = await isHotspotActive();
            setHotspotStatus(hotspotActive ? "running" : "stopped");
          } else {
            const err = (result as any)?.error || (result as any)?.missing?.join(", ");
            toaster.toast({ title: "Error", body: `Failed to install: ${err ?? "unknown error"}` });
          }
        } finally {
          setInstallingDependencies(false);
        }
      })();
    }
  }, [dependencies, installingDependencies]);

    useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await getConnectedDevices();
        // Parse device list safely
        const parsedDevices = typeof devices === "string" ? JSON.parse(devices) : devices;
        const newDeviceList = (Array.isArray(parsedDevices) ? parsedDevices : [])
          .filter(d => d.ip && d.hostname);

        // Store updated device list and the updated announcements
        setConnectedDevices(newDeviceList);

      } catch (error) {
        console.error("Failed to fetch connected devices:", error);
        setConnectedDevices([]);
      }
    };
  
    // Poll every 5 seconds when hotspot is running
    if (hotspotStatus === "running") {
      fetchDevices(); // Fetch immediately when hotspot starts
  
      const interval = setInterval(() => {
        fetchDevices();
      }, 2000); // Poll every 5 seconds
  
      return () => clearInterval(interval);
    }
  
    // Explicitly return undefined when not polling
    return undefined;
  }, [hotspotStatus]);

  
  const spinnerStyle = {
    animation: "spin 1s linear infinite"
  };
  
  const Spinner = () => (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <FaSpinner style={{ ...spinnerStyle }} />
      </span>
    </>
  );
  
  const handleClick = async () => {
    if (passphrase.length < 8 || passphrase.length > 63) {
      toaster.toast({ title: "Error", body: "Password must be between 8 and 63 characters." });
      return;
    }
  
    setHotspotStatus("loading");
  
    try {
      if (hotspotStatus === "stopped") {
        await startHotspot();
        setHotspotStatus("running");
        toaster.toast({ title: "Hotspot Started", body: `SSID: ${ssid}` });
      } else {
        await stopHotspot();
        setHotspotStatus("stopped");
        toaster.toast({ title: "Hotspot Stopped", body: "Hotspot has been disabled." });
      }
    } catch (error) {
      toaster.toast({ title: "Error", body: "Failed to toggle hotspot." });
    } finally {
      const hotspotActive = await isHotspotActive();
      setHotspotStatus(hotspotActive ? "running" : "stopped");
    }
  };
  
  if (dependencies && (!dependencies["dnsmasq"] || !dependencies["hostapd"])) {

    return (
      <PanelSection title="Installing dependencies">
        <PanelSectionRow>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Spinner />
            <span>{installingDependencies ? "Installing dependencies..." : "Finalizing..."}</span>
          </div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  
  return (
    <>
      <PanelSection title="Hotspot Control">
        <PanelSectionRow>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "16px",
                  color:
                    hotspotStatus === "running"
                      ? "#2e7d32"
                      : hotspotStatus === "stopped"
                      ? "#c62828"
                      : undefined,
                }}
              >
                {hotspotStatus === "running"
                  ? "Hotspot running"
                  : hotspotStatus === "stopped"
                  ? "Hotspot stopped"
                  : "Processing..."}
              </div>

              {hotspotStatus === "running" && (
                <div style={{ fontSize: "13px", color: "#aaa" }}>
                  <b>Host IP</b>: {ipAddress}
                </div>
              )}
            </div>
              <DialogButton
                onClick={handleClick}
                disabled={hotspotStatus === "loading"}
                style={{
                  height: "36px",
                  minWidth: "0px",
                  maxWidth: "80px",
                  padding: "4px 8px",
                  marginLeft: "16px",
                  marginRight: "16px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {hotspotStatus === "loading" ? (
                  <Spinner />
                ) : hotspotStatus === "running" ? (
                  <>
                    <FaWifi style={{ marginRight: "6px" }} /> Stop
                  </>
                ) : (
                  <>
                    <FaWifi style={{ marginRight: "6px" }} /> Start
                  </>
                )}
              </DialogButton>
          </PanelSectionRow>
        {isBlocked && (
          <PanelSectionRow>
            <p style={{ color: "red" }}>⚠ Please enable WiFi to use the hotspot.</p>
          </PanelSectionRow>
        )}
      </PanelSection>
  
      {hotspotStatus === "running" && (
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
                <Focusable
                  style={{
                    maxHeight: "32px", 
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  flow-children="horizontal"
                >
                  <DialogButton
                    onClick={() => handleKickDevice(device.mac)}
                    style={{
                      width: "32px",
                      height: "32px",
                      padding: 0,
                      marginRight: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "32px",
                      maxWidth: "32px",
                    }}
                  >
                    <BootIcon />
                  </DialogButton>
                </Focusable>
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
                baseIp,
                dhcpStart,
                dhcpEnd,
                async (
                  newSsid: string,
                  newPassphrase: string,
                  alwaysUse: boolean,
                  ip: string,
                  dhcpStart: string,
                  dhcpEnd: string
                ) => {
                  const updatedConfig = await callable<
                    [string, string, boolean],
                    { ssid: string; passphrase: string; always_use_stored_credentials: boolean }
                  >("update_credentials")(newSsid, newPassphrase, alwaysUse);
              
                  setSsid(updatedConfig.ssid);
                  setPassphrase(updatedConfig.passphrase);
                  setAlwaysUseStoredCredentials(updatedConfig.always_use_stored_credentials);
                  setBaseIp(ip);
                  setDhcpStart(dhcpStart);
                  setDhcpEnd(dhcpEnd);
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

  const onMuonDeviceEvent = async (payload: any) => {
    const msg = typeof payload === "string"
      ? (() => { try { return JSON.parse(payload); } catch { return {}; } })()
      : payload;

    if (msg?.type === "connected") {
      toaster.toast({
        title: "Device Connected",
        body: `${msg.hostname ?? "Unknown"} (${msg.ip ?? msg.mac ?? "?"})`,
        showToast: true,
      });
    } else if (msg?.type === "disconnected") {
      toaster.toast({
        title: "Device Disconnected",
        body: msg.hostname ?? msg.mac ?? "Unknown device",
        showToast: true,
      });
    }
  };
  if (!_muonListenerRegistered) {
    addEventListener("muon_device_event", onMuonDeviceEvent);
    _muonListenerRegistered = true;
  }

  const suspendRequestRegistration =
    window.SteamClient.System.RegisterForOnSuspendRequest?.bind(window.SteamClient.System) ??
    sleepManager?.RegisterForNotifyRequestSuspend;

  const suspendResumeRegistration =
    window.SteamClient.System.RegisterForOnResumeFromSuspend?.bind(window.SteamClient.System) ??
    sleepManager?.RegisterForNotifyResumeFromSuspend;

  const unregisterSuspend = suspendRequestRegistration
    ? suspendRequestRegistration(() => call<[]>("suspend_ap"))
    : { unregister: () => {} };

  const unregisterResume = suspendResumeRegistration
    ? suspendResumeRegistration(() => call<[]>("resume_ap"))
    : { unregister: () => {} };

  return {
    name: "Muon",
    titleView: <div className={staticClasses.Title}>Muon</div>,
    content: <Content />, 
    icon: <FaWifi />, 
    onDismount() {
      unregisterSuspend.unregister();
      unregisterResume.unregister();
      if (_muonListenerRegistered) {
        removeEventListener("muon_device_event", onMuonDeviceEvent);
        _muonListenerRegistered = false;
      }
    }
  };
});