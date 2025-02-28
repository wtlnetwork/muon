import os
import asyncio
import decky
import subprocess
from settings import SettingsManager

class Plugin:
    # DECKY WORKFLOW METHODS
    def __init__(self):
        self.wifi_interface = "wlan0"
        self.settingsDir = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp")
        decky.logger.info(f"Settings path: {os.path.join(self.settingsDir, 'hotspot_settings.json')}")
        self.ip_address = "192.168.8.1"
        self.dhcp_range = "192.168.8.100,192.168.8.200,12h"
        self.hotspot_active = False
        self.ssid = None
        self.passphrase = None

    async def _main(self):
        decky.logger.info("Hotspot Plugin Loaded")
        self.settings = SettingsManager(name="hotspot_settings", settings_directory=self.settingsDir)
        self.settings.read()
        await self.load_settings()

    async def _unload(self):
        decky.logger.info("Stopping Hotspot Plugin")
        if self.hotspot_active:
            await self.stop_hotspot()
        decky.logger.info("Plugin Unloaded")

    # SETTINGS METHODS
    async def load_settings(self):
        """Ensures SSID and passphrase are properly initialized in all cases and returns them to the frontend."""
        always_use = self.settings.getSetting("always_use_stored_credentials", "false")
        self.always_use_stored_credentials = always_use == "true"

        # Check session persistence
        if not (self.ssid and self.passphrase):
            stored_ssid = self.settings.getSetting("ssid", None)
            stored_passphrase = self.settings.getSetting("passphrase", None)

            if self.always_use_stored_credentials:
                # Use stored credentials, create failsafe if missing
                if not (stored_ssid and stored_passphrase):
                    decky.logger.warning("[Settings] Stored credentials missing! Generating failsafe.")
                    stored_ssid = await self.get_hostname()
                    stored_passphrase = self.generate_random_password()
                    self.save_credentials(stored_ssid, stored_passphrase, True)

                self.ssid = stored_ssid
                self.passphrase = stored_passphrase
            else:
                # Generate new credentials if none are set
                self.ssid = await self.get_hostname()
                self.passphrase = self.generate_random_password()

        decky.logger.info(f"[Settings] SSID={self.ssid}, Passphrase={self.passphrase}, AlwaysUseStored={self.always_use_stored_credentials}")
        return {"ssid": self.ssid, "passphrase": self.passphrase, "always_use_stored_credentials": self.always_use_stored_credentials}

    async def settings_read(self):
        """Read settings from storage, ensuring they are initialized asynchronously."""
        decky.logger.info("Reading hotspot settings...")

        ssid = self.settings.getSetting("ssid", None)
        passphrase = self.settings.getSetting("passphrase", None)
        always_use = self.settings.getSetting("always_use_stored_credentials", "false")

        if not ssid or not passphrase:
            await self.load_settings()
            ssid = self.settings.getSetting("ssid")
            passphrase = self.settings.getSetting("passphrase")
            always_use = self.settings.getSetting("always_use_stored_credentials", "false")

        return {"ssid": ssid, "passphrase": passphrase, "always_use_stored_credentials": always_use}

    async def update_credentials(self, new_ssid, new_passphrase, always_use):
        """Updates SSID and passphrase, storing to JSON only if always_use_stored_credentials is enabled."""
        self.ssid = new_ssid
        self.passphrase = new_passphrase
        self.always_use_stored_credentials = always_use

        if always_use:
            self.settings.setSetting("ssid", new_ssid)
            self.settings.setSetting("passphrase", new_passphrase)
            self.settings.setSetting("always_use_stored_credentials", "true")
            self.settings.commit()
        else:
            self.settings.setSetting("always_use_stored_credentials", "false")
            self.settings.commit()

        decky.logger.info(f"Updated credentials: SSID={self.ssid}, Passphrase={self.passphrase}, AlwaysUse={self.always_use_stored_credentials}")

        return {"ssid": self.ssid, "passphrase": self.passphrase, "always_use_stored_credentials": self.always_use_stored_credentials}

    # HOTSPOT CONTROL METHODS
    async def start_hotspot(self):
            decky.logger.info("Starting Hotspot")

            try:
                ssid = self.ssid
                passphrase = self.passphrase

                decky.logger.info(f"Using SSID: {ssid}, Passphrase: {passphrase} (Always Use: {self.always_use_stored_credentials})")

                if not ssid or not passphrase:
                    decky.logger.error("SSID or Passphrase is missing! Aborting.")
                    return False

                await self.check_dependencies()
                await self.configure_firewalld()
                await self.ensure_wlan0_up()
                await self.start_wifi_ap(ssid, passphrase)
                await self.start_dhcp_server()

                self.hotspot_active = True
                decky.logger.info("Hotspot is active")
                self.wlan_ip = await self.run_command(fr"ip addr show {self.wifi_interface} | grep -oP 'inet \K[\d.]+/\d+'")
                decky.logger.info(f"Using WLAN IP address: {self.wlan_ip}")
            except Exception as e:
                decky.logger.error(f"Failed to start hotspot: {str(e)}")

    async def stop_hotspot(self):
        decky.logger.info("Stopping Hotspot")
        try:
            script_path = os.path.join(os.path.dirname(__file__), "backend/src/stop_hotspot.sh")

            result = await self.run_command(
                f"bash {script_path} {self.wifi_interface}"
            )

            if "Network configuration restored successfully" in result:
                self.hotspot_active = False
                decky.logger.info("Network configuration restored successfully.")
            else:
                decky.logger.error("Failed to restore network configuration.")

            decky.logger.info("Hotspot stopped")
        except Exception as e:
            decky.logger.error(f"Failed to stop hotspot: {str(e)}")

    # Check if the hotspot is currently running using nmcli
    async def is_hotspot_active(self) -> bool:
        try:
            # Check for active WiFi connections and filter for mode 'ap'
            result = await self.run_command("nmcli -t -f NAME,TYPE,DEVICE connection show --active | grep ':wifi:'", check=False)
            # Check the mode of the active WiFi device
            mode_check = await self.run_command("nmcli -t -f MODE dev wifi list | grep '^AP'", check=False)
            # If the device is in AP mode, it is an active hotspot
            is_active = bool(mode_check.strip())
            decky.logger.info(f"Hotspot status: {'Active' if is_active else 'Inactive'}")
            return is_active
        except Exception as e:
            decky.logger.error(f"Error checking hotspot status: {e}")
            return False

    async def start_wifi_ap(self, ssid, passphrase):
        decky.logger.info("Starting Hotspot")
        script_path = os.path.join(os.path.dirname(__file__), "backend/src/start_hotspot.sh")

        result = await self.run_command(
            f"bash {script_path} {self.wifi_interface} {self.ip_address} {ssid} {passphrase}"
        )

        if "Hotspot started successfully" in result:
            self.hotspot_active = True
            decky.logger.info("Hotspot is active.")
        else:
            decky.logger.error("Failed to start Hotspot.")

    # Check if the WiFi has been disabled
    async def is_rfkill_blocking_wlan(self):
        """Checks if rfkill is blocking the Wireless LAN device using run_command."""
        try:
            rfkill_output = await self.run_command("rfkill list")

            if not rfkill_output:
                decky.logger.error("rfkill command returned empty output.")
                return False  # Default to not blocked

            # Find Wireless LAN device
            in_wlan_section = False
            for line in rfkill_output.splitlines():
                line = line.strip()
                if "Wireless LAN" in line:
                    in_wlan_section = True
                elif in_wlan_section:
                    if "Soft blocked: yes" in line or "Hard blocked: yes" in line:
                        return True  # WLAN is blocked
                    if line.startswith("0:") or line.startswith("1:"):  # Next device section
                        break  # Stop checking after Wireless LAN section

            return False  # Not blocked

        except Exception as e:
            decky.logger.error(f"Error checking rfkill: {e}")
            return False  # Default to not blocked if there's an error

    # DEPENDENCY MANAGEMENT METHODS
    async def check_dependencies(self):
        """Ensure required dependencies are installed."""
        statuses = {}
        for dep in ["dnsmasq", "hostapd"]:
            result = await self.run_command(f"which {dep}")
            statuses[dep] = bool(result)
            if not result:
                decky.logger.error(f"ERROR: `{dep}` is not installed.")
        decky.logger.info("Dependency statuses: " + str(statuses))
        return statuses

    async def install_dependencies(self, install_dnsmasq: bool, install_hostapd: bool):
        """Installs dnsmasq and hostapd using a shell script."""
        script_path = os.path.join(os.path.dirname(__file__), "backend/src/install_dependencies.sh")

        # Convert booleans to strings for shell script compatibility
        dnsmasq_flag = "true" if install_dnsmasq else "false"

        decky.logger.info("Installing dependencies via Shell Script")

        result = await self.run_command(
            f"bash {script_path} {dnsmasq_flag}"
        )

        if "Dependencies installed successfully" in result:
            decky.logger.info("Dependencies installed successfully.")
            return {"success": True}
        
        decky.logger.error("Failed to install dependencies.")
        return {"success": False, "error": "Check logs for details"}

    # FIREWALL AND DHCP SERVICES
    async def configure_firewalld(self):
        """Configure firewalld for broadcast and DHCP traffic using a shell script."""
        script_path = os.path.join(os.path.dirname(__file__), "backend/src/change_firewall_settings.sh")

        decky.logger.info("Configuring firewalld...")

        result = await self.run_command(
            f"bash {script_path} {self.ip_address}"
        )

        if "Firewalld configuration updated successfully" in result:
            decky.logger.info("Firewalld configured successfully.")
        else:
            decky.logger.error("Failed to configure firewalld.")


    async def start_dhcp_server(self):
        """Start the DHCP server using a shell script."""
        script_path = os.path.join(os.path.dirname(__file__), "backend/src/start_dhcp_server.sh")

        decky.logger.info("Starting DHCP Server.")

        result = await self.run_command(
            f"bash {script_path} {self.wifi_interface} {self.dhcp_range} {self.ip_address}"
        )

        if "dnsmasq is running" in result:
            decky.logger.info("DHCP Server started successfully.")
        else:
            decky.logger.error("Failed to start DHCP Server.")

    # SUSPENSION METHODS
    async def suspend_ap(self):
        if self.hotspot_active:
            decky.logger.info("Suspending, disabling hotspot...")
            await self.stop_hotspot()

    async def resume_ap(self):
        decky.logger.info("Resuming from suspension...")


    # UTILITY METHODS
    async def run_command(self, command: str, check: bool = False):
        result = await asyncio.create_subprocess_shell(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        stdout, stderr = await result.communicate()
        decky.logger.error(f"Command error: {stderr.decode().strip()}") if stderr else None
        return stdout.decode().strip()

    async def ensure_wlan0_up(self):
        """Ensure the wlan0 interface is available and up."""
        decky.logger.info("Checking wlan0 status...")
        # Check the status of the primary wireless networking device (almost always wlan0)
        result = await self.run_command("ip link show wlan0")
        decky.logger.info(f"wlan0 status: {result}")

        #If the WiFi is down, bring it up:
        if "state DOWN" in result:
            decky.logger.info("wlan0 is down. Bringing it up...")
            await self.run_command("sudo ip link set wlan0 up")

        # If the WiFi chip is missing for some reason:
        elif "state UNKNOWN" in result:
            decky.logger.error("wlan0 interface not found. Check your WiFi adapter.")
            raise Exception("wlan0 interface not found.")

    async def get_hostname(self):
        """Returns the current system hostname."""
        # Return the hostname of the system
        decky.logger.info("Fetching system hostname...")
        return os.uname()[1]

    def generate_random_password(self):
        """Generates a secure 8-character password."""
        import random
        # Randomly select eight characters from the charset variable and return them. Letters and numbers have been chosen to be unambiguous
        charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
        return ''.join(random.choice(charset) for _ in range(8))
