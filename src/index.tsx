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
import { FaWifi, FaSpinner } from "react-icons/fa";

const startHotspot = callable<[ssid: string, passphrase: string], void>("start_hotspot");
const stopHotspot = callable<[], void>("stop_hotspot");
const getHostname = callable<[], string>("get_hostname");
const checkDependencies = callable<[], boolean>("check_dependencies");

function generateRandomPassword() {
  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; // Avoiding ambiguous characters
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

function Content() {
  const [hotspotStatus, setHotspotStatus] = useState<"start" | "loading" | "stop">("start");
  const [ssid, setSsid] = useState("Steam Deck");
  const [passphrase] = useState(generateRandomPassword());
  const [dependenciesOk, setDependenciesOk] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchHostnameAndDependencies = async () => {
      const systemHostname = await getHostname();
      setSsid(systemHostname);
      const depsOk = await checkDependencies();
      setDependenciesOk(depsOk);
    };
    fetchHostnameAndDependencies();
  }, []);

  const handleClick = async () => {
    if (passphrase.length < 8 || passphrase.length > 63) {
      toaster.toast({ title: "Error", body: "Password must be between 8 and 63 characters." });
      return;
    }

    setHotspotStatus("loading");
    try {
      if (hotspotStatus === "start") {
        await startHotspot(ssid, passphrase);
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
