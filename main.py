import json
import os
import asyncio
import re
import decky
import subprocess
from pathlib import Path
from settings import SettingsManager

class Plugin:
    # Define default WiFi interface, plugin directory, settings file, IP/DHCP range, and initialise statuses.
    def __init__(self):
        self.wifi_interface = "wlan0"
        self.ap_interface = "muon0"
        self.settingsDir = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp")
        self.assetsDir = Path(decky.DECKY_PLUGIN_DIR) / "assets"
        self.ip_address = "192.168.8.1"
        self.dhcp_range = "192.168.8.100,192.168.8.200,12h"
        self.hotspot_active = False
        self.ssid = None
        self.passphrase = None
        self.current_directory = os.path.dirname(__file__)

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

    async def _uninstall(self):
        decky.logger.info("Stopping Hotspot Plugin")
        if self.hotspot_active:
            await self.stop_hotspot()

        decky.logger.info("Cleaning up dependencies.")
        script_path = os.path.join(self.assetsDir, "remove_dependencies.sh")
        await self.run_command(
            f"bash {script_path}"
        )

    # SETTINGS METHODS
    async def load_settings(self):
        # Ensures SSID and passphrase are properly initialized in all cases and returns them to the frontend.
        always_use = self.settings.getSetting("always_use_stored_credentials", "false")
        self.always_use_stored_credentials = always_use == "true"

        # Check if SSID and passphrase are set. If not, load from settings.
        if not (self.ssid and self.passphrase):
            stored_ssid = self.settings.getSetting("ssid", None)
            stored_passphrase = self.settings.getSetting("passphrase", None)

            if self.always_use_stored_credentials:
                # Use stored creds, or use the Steam Deck hostname and generate random password if not set.
                if not (stored_ssid and stored_passphrase):
                    decky.logger.warning("[Settings] Stored credentials missing! Generating failsafe.")
                    stored_ssid = await self.get_hostname()
                    stored_passphrase = self.generate_random_password()
                    await self.update_credentials(stored_ssid, stored_passphrase, True)

                self.ssid = stored_ssid
                self.passphrase = stored_passphrase
            else:
                # Failsafe is to use the Steam Deck hostname and generate random password.
                self.ssid = await self.get_hostname()
                self.passphrase = self.generate_random_password()

        # Use the IP address and DHCP range from the settings if available, if not use the defaults.
        self.ip_address = self.settings.getSetting("ip_address", "192.168.8.1")
        self.dhcp_range = self.settings.getSetting("dhcp_range", "192.168.8.100,192.168.8.200,12h")
        decky.logger.info(f"[Settings] SSID={self.ssid}, Passphrase={self.passphrase}, AlwaysUseStored={self.always_use_stored_credentials}")
        return {
            "ssid": self.ssid,
            "passphrase": self.passphrase,
            "always_use_stored_credentials": self.always_use_stored_credentials,
            "ip_address": self.ip_address,
            "dhcp_range": self.dhcp_range,
        }
    
    async def settings_read(self):
        # Read settings from storage.
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
        # Updates SSID and passphrase, storing only if always_use_stored_credentials is enabled.
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
                await self.capture_network_config()
                await self.capture_service_states()
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
            script_path = os.path.join(self.assetsDir, "stop_hotspot.sh")
            dns_servers = ",".join(self.original_dns) if self.original_dns else ""

            decky.logger.info("Restoring network configuration")

            result = await self.run_command(
                f"bash {script_path} {self.wifi_interface} {self.original_ip or ''} {self.original_gateway or ''} {dns_servers}"
            )

            if "Network configuration restored successfully" in result:
                self.hotspot_active = False
                decky.logger.info("Network configuration restored successfully.")
            else:
                decky.logger.error("Failed to restore network configuration.")

            decky.logger.info("Hotspot stopped")
        except Exception as e:
            decky.logger.error(f"Failed to stop hotspot: {str(e)}")

    async def is_hotspot_active(self) -> bool:
        # Checks if the hostapd service is running.
        try:
            result = await self.run_command("pgrep -x hostapd", check=False)
            is_active = bool(result.strip())
            decky.logger.info(f"Hotspot status: {'Active' if is_active else 'Inactive'}")
            return is_active
        except Exception as e:
            decky.logger.error(f"Error checking hotspot status: {e}")
            return False

    async def start_wifi_ap(self, ssid, passphrase):
        decky.logger.info("Starting Hotspot")
        script_path = os.path.join(self.assetsDir, "start_hotspot.sh")

        result = await self.run_command([
            "bash",
            script_path,
            self.wifi_interface,
            self.ip_address,
            ssid,
            passphrase
        ])

        if "Hotspot started successfully" in result:
            self.hotspot_active = True
            decky.logger.info("Hotspot is active.")
        else:
            decky.logger.error("Failed to start Hotspot.")

    # Check if the WiFi has been disabled
    async def is_rfkill_blocking_wlan(self):
        try:
            rfkill_output = await self.run_command("rfkill list")

            if not rfkill_output:
                decky.logger.error("rfkill command returned empty output.")
                return False  # Default to not blocked

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
        # Ensure required dependencies are installed.
        statuses = {}
        for dep in ["dnsmasq", "hostapd"]:
            result = await self.run_command(f"which {dep}")
            statuses[dep] = bool(result)
            if not result:
                decky.logger.error(f"ERROR: `{dep}` is not installed.")
        decky.logger.info("Dependency statuses: " + str(statuses))
        return statuses

    async def install_dependencies(self):
        # Path to install script
        script_path = os.path.join(self.assetsDir, "install_dependencies.sh")

        decky.logger.info(f"Installing dependencies via shell script.")

        result = await self.run_command(
            f"bash {script_path}",
            cwd=self.assetsDir
        )

        # Recheck dependencies after script runs
        statuses = await self.check_dependencies()

        missing = [dep for dep, ok in statuses.items() if not ok]
        if missing:
            decky.logger.error(f"Missing after install: {missing}")
            return {"success": False, "missing": missing}

        decky.logger.info("All dependencies confirmed installed.")
        return {"success": True}

    # NETWORK CONFIGURATION AND SERVICE METHODS
    async def capture_network_config(self):
        script_path = os.path.join(self.assetsDir, "extract_network_config.sh")
        decky.logger.info("Extracting network configuration via Shell Script")

        result = await self.run_command(f"bash {script_path} {self.wifi_interface}")

        # Parsing of shell output into a dictionary
        config = {}
        for line in result.splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip()

        ip_address = config.get("IP_ADDRESS")
        gateway = config.get("GATEWAY")
        dns_servers = config.get("DNS_SERVERS", "").split(",")

        decky.logger.info(f"Extracted IP: {ip_address}")
        decky.logger.info(f"Extracted Gateway: {gateway}")
        decky.logger.info(f"Extracted DNS Servers: {dns_servers}")

        self.original_ip = ip_address
        self.original_gateway = gateway
        self.original_dns = dns_servers
        decky.logger.info(f"Captured original network config: IP={self.original_ip}, Gateway={self.original_gateway}, DNS={self.original_dns}")

        return ip_address, gateway, dns_servers

    async def capture_service_states(self):
        # Capture the current state of NetworkManager and iwd before stopping them.
        decky.logger.info("Capturing service states for NetworkManager and iwd...")
        # Initialise variable for storing service states
        self.service_states = {}
        # Array of services to check
        services = ["NetworkManager", "iwd"]

        # For each service in the services array:
        for service in services:
            # Check if the service is running
            status = await self.run_command(f"sudo systemctl is-active {service}")
            # Save the state of the service into the service_states array
            self.service_states[service] = status.strip() == "active"  # Store True if active, False if inactive
            decky.logger.info(f"Service {service}: {'Active' if self.service_states[service] else 'Inactive'}")

        decky.logger.info(f"Captured service states: {self.service_states}")

    async def configure_firewalld(self):
        # Configure firewalld for broadcast and DHCP traffic using a shell script.
        script_path = os.path.join(self.assetsDir, "change_firewall_settings.sh")

        decky.logger.info("Configuring firewalld...")

        result = await self.run_command(
            f"bash {script_path} {self.ip_address}"
        )

        if "Firewalld configuration updated successfully" in result:
            decky.logger.info("Firewalld configured successfully.")
        else:
            decky.logger.error("Failed to configure firewalld.")

    async def update_dhcp(self, ip_address: str, dhcp_start: str, dhcp_end: str, lease_time: str = "12h"):
        import ipaddress
        try:
            ip = ipaddress.IPv4Address(ip_address)
            start = ipaddress.IPv4Address(dhcp_start)
            end = ipaddress.IPv4Address(dhcp_end)

            for addr in [ip, start, end]:
                if not addr.is_private:
                    raise ValueError("Address not in private range.")

            if ip.exploded.rsplit('.', 1)[0] != start.exploded.rsplit('.', 1)[0] or start.exploded.rsplit('.', 1)[0] != end.exploded.rsplit('.', 1)[0]:
                raise ValueError("All addresses must be in the same /24 subnet.")

            if int(start) >= int(end):
                raise ValueError("DHCP start must be less than end.")

            self.ip_address = str(ip)
            self.dhcp_range = f"{start},{end},{lease_time}"

            self.settings.setSetting("ip_address", self.ip_address)
            self.settings.setSetting("dhcp_range", self.dhcp_range)
            self.settings.commit()

            return {"ip_address": self.ip_address, "dhcp_range": self.dhcp_range}
        except Exception as e:
            decky.logger.error(f"Failed to update DHCP config: {e}")
            return {"error": str(e)}

    async def start_dhcp_server(self):
        # Start the DHCP server using a shell script.
        script_path = os.path.join(self.assetsDir, "start_dhcp_server.sh")

        decky.logger.info("Starting DHCP Server.")

        result = await self.run_command(
            f"bash {script_path} {self.wifi_interface} {self.dhcp_range} {self.ip_address}"
        )

        if "dnsmasq is running" in result:
            decky.logger.info("DHCP Server started successfully.")
        else:
            decky.logger.error("Failed to start DHCP Server.")

    async def get_ip_address(self) -> str:
        return self.ip_address

    

    # SUSPENSION METHODS
    async def suspend_ap(self):
        # This function disables the hotspot if the Steam Deck is suspended.
        if self.hotspot_active:
            decky.logger.info("Suspending, disabling hotspot...")
            await self.stop_hotspot()

    async def resume_ap(self):
        # Function for resuming the hotspot after suspension.
        # At the moment, this just adds a log entry. It's mainly for debugging.
        decky.logger.info("Resuming from suspension...")


    # CLIENT LIST METHODS
    async def get_connected_devices(self):
        # Combines output from hostapd_cli and dnsmasq to return connected devices info
        # in JSON format.
        decky.logger.info("Fetching connected devices...")

        # Hostapd and dnsmasq locations
        hostapd_cmd = f"sudo hostapd_cli -p /var/run/hostapd -i {self.ap_interface} all_sta"
        dnsmasq_leases_file = "/var/lib/misc/dnsmasq.leases"

        # Dictionary to store device info
        devices = {}

        try:
            # Get the output from hostapd_cli using the run_command utility
            hostapd_output = await self.run_command(hostapd_cmd)

            # Parse hostapd output for MAC and signal strength
            current_mac = None
            for line in hostapd_output.splitlines():
                line = line.strip()

                # Match MAC address
                if re.match(r"^[0-9a-fA-F:]{17}$", line):
                    current_mac = line
                    devices[current_mac] = {
                        "mac": current_mac,
                        "ip": None,
                        "hostname": None,
                        "signal_strength": None
                    }
                # Match signal strength
                elif line.startswith("signal=") and current_mac:
                    signal_strength = int(line.split("=")[-1])
                    # Normalize to negative
                    if signal_strength > 0:
                        signal_strength = -signal_strength
                    devices[current_mac]["signal_strength"] = signal_strength

        except Exception as e:
            decky.logger.error(f"Error running hostapd_cli: {str(e)}")
            return json.dumps({"error": "Failed to retrieve data from hostapd_cli"})

        # Read and parse dnsmasq leases file
        try:
            with open(dnsmasq_leases_file, 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 4:
                        mac = parts[1]
                        ip = parts[2]
                        hostname = parts[3]

                        # If MAC is already in devices dict, add IP and hostname
                        if mac in devices:
                            devices[mac]["ip"] = ip
                            devices[mac]["hostname"] = hostname

        except FileNotFoundError:
            decky.logger.error(f"Error: {dnsmasq_leases_file} not found.")
            return json.dumps({"error": "dnsmasq leases file not found"})

        # Convert to JSON format
        connected_devices_json = json.dumps(list(devices.values()), indent=4)
        decky.logger.info(f"Connected Devices: {connected_devices_json}")

        return connected_devices_json
    
    # CLIENT BLACKLISTING METHODS
    async def kick_mac(self, mac_address: str) -> bool:
        """Kick and block a MAC address from the hotspot."""
        try:
            # Deauthenticate the device (kick it off the hotspot)
            result = await self.run_command(f"hostapd_cli -i {self.ap_interface} deauthenticate {mac_address}")

            if not result or "OK" not in result:
                decky.logger.error(f"Failed to kick MAC address: {mac_address}. Response: {result}")
                return False

            decky.logger.info(f"Successfully kicked MAC address: {mac_address}")

            # Add MAC to deny list in hostapd.deny
            hostapd_conf = "/etc/hostapd/hostapd.deny"
            with open(hostapd_conf, "a") as f:
                f.write(f"\n{mac_address}\n")

            decky.logger.info(f"Added {mac_address} to deny list in {hostapd_conf}")

            # Reload hostapd configuration
            reload_result = await self.run_command("sudo systemctl reload hostapd")

            if reload_result.strip() == "":  # Success if output is empty
                decky.logger.info("Reloaded hostapd configuration successfully.")
                return True
            else:
                decky.logger.error(f"Failed to reload hostapd configuration. Output: {reload_result}")
                return False

        except Exception as e:
            decky.logger.error(f"Error while processing MAC address {mac_address}: {e}")
            return False
        
    async def retrieve_ban_list(self) -> list:
        # Regex which matches valid MAC addresses.
        VALID_MAC_REGEX = re.compile(r"^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
        # Default MAC addresses included in the hostapd.deny file. We don't need to worry about these.
        EXCLUDED_MACS = {"00:20:30:40:50:60", "00:ab:cd:ef:12:34", "00:00:30:40:50:60"}
        """Retrieves the list of banned MAC addresses from hostapd.deny, filtering out invalid and excluded ones."""
        deny_file = "/etc/hostapd/hostapd.deny"

        try:
            if not os.path.exists(deny_file):
                decky.logger.warning("Ban list file does not exist. Returning empty list.")
                return []

            with open(deny_file, "r") as f:
                mac_addresses = [
                    line.strip()
                    for line in f
                    if VALID_MAC_REGEX.match(line.strip()) and line.strip() not in EXCLUDED_MACS
                ]

            decky.logger.info(f"Retrieved {len(mac_addresses)} valid banned MAC addresses.")
            # Return all valid MAC addresses, excluding the default ones.
            return mac_addresses

        except Exception as e:
            decky.logger.error(f"Error retrieving banned MAC addresses: {e}")
            return []

    async def unban_mac_address(self, mac_address: str) -> bool:
        # Removes a MAC address from hostapd.deny and reloads hostapd.
        deny_file = "/etc/hostapd/hostapd.deny"

        try:
            if not os.path.exists(deny_file):
                decky.logger.warning("Ban list file does not exist. Nothing to unban.")
                return False

            # Read the file and filter out the MAC address
            with open(deny_file, "r") as f:
                lines = f.readlines()

            new_lines = [line for line in lines if line.strip().lower() != mac_address.lower()]

            if len(new_lines) == len(lines):  # No changes means MAC wasn't found
                decky.logger.warning(f"MAC address {mac_address} not found in ban list.")
                return False

            # Write back the updated list
            with open(deny_file, "w") as f:
                f.writelines(new_lines)

            decky.logger.info(f"Unbanned MAC address: {mac_address}")

            # Reload hostapd to apply changes
            reload_result = await self.run_command("sudo systemctl reload hostapd")

            if reload_result.strip() == "":  # Success if no output
                decky.logger.info("Reloaded hostapd configuration successfully.")
                return True
            else:
                decky.logger.error(f"Failed to reload hostapd. Output: {reload_result}")
                return False

        except Exception as e:
            decky.logger.error(f"Error unbanning MAC address {mac_address}: {e}")
            return False


    # UTILITY METHODS
    async def run_command(self, command, check=False, cwd=None):
            # Function to run a shell command.
            env = os.environ.copy()
            env["LD_LIBRARY_PATH"] = "/usr/lib:/usr/lib64:" + env.get("LD_LIBRARY_PATH", "")

            if cwd is None:
                cwd = os.path.dirname(__file__)

            if isinstance(command, list):
                result = await asyncio.create_subprocess_exec(
                    *command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env=env,
                    cwd=cwd
                )
            else:
                    result = await asyncio.create_subprocess_exec(
                        "/usr/bin/env", "bash", "-c", command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env=env,
                    cwd=cwd
                )

            stdout, stderr = await result.communicate()
            if stderr:
                decky.logger.error(f"Command error: {stderr.decode().strip()}")
            return stdout.decode().strip()

    async def ensure_wlan0_up(self):
        # Ensure the wlan0 interface is available and up.
        decky.logger.info("Checking wlan0 status...")
        # Check the status of the primary wireless networking device (almost always wlan0)
        result = await self.run_command("ip link show wlan0")
        decky.logger.info(f"wlan0 status: {result}")

        # If the WiFi is down, bring it up:
        if "state DOWN" in result:
            decky.logger.info("wlan0 is down. Bringing it up...")
            await self.run_command("sudo ip link set wlan0 up")

        # If the WiFi chip is missing for some reason (this should never happen, but good to handle it cleanly):
        elif "state UNKNOWN" in result:
            decky.logger.error("wlan0 interface not found. Check your WiFi adapter.")
            raise Exception("wlan0 interface not found.")

    async def get_hostname(self):
        # Returns the current system hostname
        decky.logger.info("Fetching system hostname...")
        return os.uname()[1]

    def generate_random_password(self):
        import random
        # Randomly select eight characters from the charset variable and return them. Letters and numbers have been chosen to be unambiguous
        charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
        return ''.join(random.choice(charset) for _ in range(8))
