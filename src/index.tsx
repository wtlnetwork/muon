import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster
} from "@decky/api";
import { useState } from "react";
import { FaWifi, FaSpinner } from "react-icons/fa";

const startHotspot = callable<[ssid: string, passphrase: string], void>("start_hotspot");
const stopHotspot = callable<[], void>("stop_hotspot");

function Content() {
  const [hotspotStatus, setHotspotStatus] = useState<"start" | "loading" | "stop">("start");

  const handleClick = async () => {
    setHotspotStatus("loading");
    try {
      if (hotspotStatus === "start") {
        await startHotspot("Steam Deck", "MySecurePass");
        setHotspotStatus("stop");
        toaster.toast({ title: "Hotspot Started", body: "Your Steam Deck is now a hotspot." });
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

  return (
    <PanelSection title="Hotspot Control">
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
