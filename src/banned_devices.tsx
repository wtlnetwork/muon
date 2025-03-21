import { ModalRoot, showModal } from "@decky/ui";
import { useEffect, useState } from "react";
import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { FaTrash, FaTimes } from "react-icons/fa";
import { callable, toaster } from "@decky/api";

// Function to show the banned devices modal
export const showBannedDevicesModal = () => {
  showModal(<BannedDevicesModal />, undefined, { strTitle: "Banned Devices" });
};

export const BootIcon = () => {
  return (
    <img
      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAG3RFWHRTb2Z0d2FyZQBDZWxzeXMgU3R1ZGlvIFRvb2zBp+F8AAAECElEQVRYhe2Wy28bRRzHv7ObV6kIt0pISBwoEmo5FJGqKSCRkJeicEGIA4fCBVo4wQkEfwBF4gIckO0NB3IoQkKIkredOERNmkdLSRU3qYOJ2uYQJxLIeIl3vbMzPw778O5iJ61IgENXljyamd/v+/k9ZnYZEeG/fNh9gP89QOZm9n3b5h/btq23nDjR/K8BZNaybwguNM4tCCEAACTR13ry6ZEDBcjcXO0SQiQ5tyGEAEkAcPaUgDsvnGx59EAAlldWmyXRHOfWMZ3bjiS5sgCodAhACUR4vLP9+dy+AizfWPnIFuIDi1vYETugkrdM7i+UpYXO9rbWfQNYyiy/yrl9oWgVQSVHiCrhOwBEAAtYERq7OtqtfQGYX7x6Q/9TP+aLBYUD44o2AcC3PZ0dr9yNwMKVK18Vi/pr5AaiKMrq4cMPvPRM66ksALDkZPpJAMsVLUJ0HCmBN/dEb3dXtpbw3MJik67rBuc2SEq3pwgEgqqoqG+oT3R3dpxjRITkZPoXEI56DRmC8E4JC2aCAOC73p7ul2sBjIwlSQjbL2fln0CSYJgGptNTxxkRYSw1cQTAVlSU4GxmjEXcOw77enuiC674eMa27eO+qHR6iMjNAhEW5udRKBQu+8dwdDw1AaDDc+7MO+MwAPmOXuzrZQAwN/9jC4Di6da2tWRqss00zSkZsHdSD6+7UbYsTKZSUNW6n0IX0cjYuJ99Iolw61egvD2M4WdFUZ6SUoKBQVVV2EKYtm03BUWjJd26dQtL2SwUpnwaAhgeHXsWhBlyjRnz9Lwa+iROLSnSnu5cGDhg7+6/ND0Ny+KIx79gf7uKh0ZGu4lo3IcOOvScuo68MRhDOOKKXTQLuq5jdnYG9XV1n8XjsXervowuDg6fATDgy7o9ET0lUVuKilbJxvWl69jeyqP/S40BNd6GyYn0oXK5XBJChOirQUQFvLGPErAzTROzM7NgCvtcS8TeqQkAAEPDoybnvDEUmV/3QCMGM1IDyrO7du0qCr8X/Oh3Bfj+4uAZKeVAMK3RGw3uEQ1FXyX9QgisZDLIb29DVZWHtUQ8vyfAD0PDly2Lnw41V8SxlNJxErgnguumaSK/mcdmfhOlUgkMeEzT4utBndoAg8OXyuXyc55TIoJhGMjlcij+UYRh7rgQThmYoqCpsQGqqkKShGGUIYQNhTGA4ZN+TXuvms5uAO2GYaS95ln/dR35rbxzNSv+KTsPYAbAI4BsBtBAEr8B7A4ADsip/n5NVBXYCwAALnz9zUMbG7c31tZyDypMCQoDwKKWiJ3azfndPHt+FZ8993YbQFOQAIVv5te1RGzgwAEA4M2zbwU3ndcSsQ//qfC9AhwFsKUlYvp+Cd8TwEE+9wH+Al0wNRRBTPWQAAAADmVYSWZNTQAqAAAACAAAAAAAAADSU5MAAAAASUVORK5CYII="
      alt="Ban User"
      style={{ width: '24px', height: '24px' }}
    />
  );
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