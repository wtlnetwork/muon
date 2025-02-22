import os
import asyncio
import decky
import subprocess
import re
import socket
from settings import SettingsManager

class Plugin:
    def __init__(self):
        self.wifi_interface = "wlan0"
        self.settingsDir = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp")
        decky.logger.info(f"Settings path: {os.path.join(self.settingsDir, 'hotspot_settings.json')}")
        self.ip_address = "192.168.8.1"
        self.dhcp_range = "192.168.8.100,192.168.8.200,12h"
        self.hotspot_active = False
        self.ssid = None
        self.passphrase = None

    
    async def is_hotspot_active(self) -> bool:
        """Checks if the hostapd service is running."""
        try:
            result = await self.run_command("systemctl is-active hostapd", check=False)
            is_active = result.strip() == "active"
            decky.logger.info(f"Hotspot status: {'Active' if is_active else 'Inactive'}")
            return is_active
        except Exception as e:
            decky.logger.error(f"Error checking hotspot status: {e}")
            return False

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

    async def load_settings(self):
        """Ensures SSID and passphrase are properly initialized in all cases and returns them to the frontend."""
        always_use = self.settings.getSetting("always_use_stored_credentials", None)

        # Explicitly set default if not found
        if always_use is None:
            always_use = "false"
            self.settings.setSetting("always_use_stored_credentials", always_use)
            self.settings.commit()

        self.always_use_stored_credentials = always_use == "true"

        # Keep current SSID and passphrase if they exist (session persistence)
        if not hasattr(self, "ssid") or not hasattr(self, "passphrase"):
            self.ssid = None
            self.passphrase = None

        stored_ssid = self.settings.getSetting("ssid", None)
        stored_passphrase = self.settings.getSetting("passphrase", None)

        if self.always_use_stored_credentials:
            # Use stored credentials, but create failsafe if missing
            if not stored_ssid or not stored_passphrase:
                decky.logger.warning("Stored credentials missing! Generating failsafe credentials.")
                stored_ssid = await self.get_hostname()
                stored_passphrase = self.generate_random_password()
                self.settings.setSetting("ssid", stored_ssid)
                self.settings.setSetting("passphrase", stored_passphrase)
                self.settings.commit()
            self.ssid = stored_ssid
            self.passphrase = stored_passphrase
        else:
            # If session credentials are already set, don't overwrite them
            if not self.ssid or not self.passphrase:
                self.ssid = await self.get_hostname()
                self.passphrase = self.generate_random_password()

        decky.logger.info(f"Settings initialized: SSID={self.ssid}, Passphrase={self.passphrase}, AlwaysUse={self.always_use_stored_credentials}")

        return {"ssid": self.ssid, "passphrase": self.passphrase, "always_use_stored_credentials": self.always_use_stored_credentials}




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



    async def settings_commit(self):
        """Save settings to storage."""
        decky.logger.info("Saving hotspot settings...")
        self.settings.commit()
        return True

    async def settings_getSetting(self, key: str, default=None):
        """Retrieve a setting value."""
        decky.logger.info(f"Fetching setting: {key}")
        return self.settings.getSetting(key, default)

    async def settings_setSetting(self, key: str, value):
        """Set and save a setting value."""
        if not value:
            decky.logger.error(f"Attempted to save empty value for {key}, skipping.")
            return False

        decky.logger.info(f"Setting {key} to {value}")
        self.settings.setSetting(key, value)
        self.settings.commit()
        return True

    async def run_command(self, command: str, check: bool = False):
        result = await asyncio.create_subprocess_shell(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        stdout, stderr = await result.communicate()
        decky.logger.error(f"Command error: {stderr.decode().strip()}") if stderr else None
        return stdout.decode().strip()

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
            await self.allow_dhcp_firewalld()
            await self.allow_broadcast_firewalld()
            await self.ensure_wlan0_up()
            await self.capture_original_network_config()
            await self.capture_service_states()
            await self.stop_network_services()
            await self.configure_ip()
            await self.start_wifi_ap(ssid, passphrase)
            await self.start_dhcp_server()

            self.hotspot_active = True
            decky.logger.info("Hotspot is active")
            self.wlan_ip = await self.run_command(f"ip addr show {self.wifi_interface} | grep -oP 'inet \K[\d.]+/\d+'")
            decky.logger.info(f"Using WLAN IP address: {self.wlan_ip}")
        except Exception as e:
            decky.logger.error(f"Failed to start hotspot: {str(e)}")

    async def stop_hotspot(self):
        decky.logger.info("Stopping Hotspot")
        try:
            await self.restore_network_config()
            self.hotspot_active = False
            decky.logger.info("Hotspot Stopped")
        except Exception as e:
            decky.logger.error(f"Failed to stop hotspot: {str(e)}")

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
        """Installs dnsmasq and hostapd selectively based on missing dependencies."""
        try:
            # Create a list of commands to install, starting with a command to disable SteamOS read-only system state
            commands = ["sudo steamos-readonly disable"]

            # Append to the command list - Initialise and populate Pacman keys (SteamOS throws errors when installing dependencies if these are not initialised)
            commands.append("sudo pacman-key --init")
            commands.append("sudo pacman-key --populate archlinux")
            commands.append("sudo pacman-key --populate holo")
            
            # If dnsmasq is missing, install dnsmasq. If hostapd is missing, install hostapd. If both are missing, install both.
            if install_dnsmasq:
                commands.append("sudo pacman -Sy --noconfirm dnsmasq")
            if install_hostapd:
                commands.append("sudo pacman -Sy --noconfirm hostapd")
            
            # If all the dependencies are installed already (i.e. only the initialisation commands in the list of commands to run), return success state.
            if len(commands) == 4:
                return {"success": False, "error": "No missing dependencies to install."}

            # For every command in the list of commands, call a subprocess shell and run the command.
            for cmd in commands:
                process = await asyncio.create_subprocess_shell(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                # If any of the commands fail:
                if process.returncode != 0:
                    decky.logger.error(f"Error running command `{cmd}`: {stderr.decode().strip()}")
                    return {"success": False, "error": stderr.decode().strip()}

            decky.logger.info("Dependencies installed successfully.")
            return {"success": True}
        # If an error is encountered:
        except Exception as e:
            decky.logger.error(f"Failed to install dependencies: {str(e)}")
            return {"success": False, "error": str(e)}


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

    async def generate_dnsmasq_config(self, dnsmasq_config, wifi_interface, dhcp_range, ip_address, dnsmasq_log="/var/log/dnsmasq.log"):
        """Generate a fresh dnsmasq configuration file."""
        decky.logger.info(f"Generating dnsmasq config at {dnsmasq_config}...")
        # Generate a clean dnsmasq config - binding to a specific WiFi interface, DHCP range and IP address.
        config_content = f"""
interface={wifi_interface}
bind-dynamic
dhcp-range={dhcp_range}
dhcp-option=3,{ip_address}  # Gateway
dhcp-option=6,1.1.1.1,8.8.8.8  # DNS for clients
port=0  # Disable DNS serving
log-dhcp
log-facility={dnsmasq_log}  # Save logs here
dhcp-broadcast
"""

        # Write the dnsmasq config to a file.
        try:
            with open(dnsmasq_config, "w") as f:
                f.write(config_content)
            decky.logger.info("dnsmasq config generated successfully.")
        except Exception as e:
            decky.logger.error(f"Failed to generate dnsmasq config: {str(e)}")

    async def generate_hostapd_config(self, hostapd_config, wifi_interface, ssid, passphrase, channel=6, country_code="US"):
        """Generate a fresh hostapd configuration file."""
        decky.logger.info(f"Generating hostapd config at {hostapd_config}...")
        # Generate a fresh hostapd config file - by default we are using WiFi channel 6 and the US region. Later, we will be looking to implement a selector for these parameters in the UI.
        config_content = f"""
interface={wifi_interface}
driver=nl80211
ssid={ssid}
hw_mode=g
channel={channel}
country_code={country_code}
ieee80211d=1
ieee80211n=1
wmm_enabled=1
ht_capab=[HT40+]
auth_algs=1
wpa=2
wpa_passphrase={passphrase}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
logger_syslog=-1
logger_syslog_level=0
logger_stdout=-1
logger_stdout_level=0
disassoc_low_ack=0
"""
        # Save the hostapd config to a file.
        try:
            with open(hostapd_config, "w") as f:
                f.write(config_content)
            decky.logger.info("hostapd config generated successfully.")
        except Exception as e:
            decky.logger.error(f"Failed to generate hostapd config: {str(e)}")


    async def check_dnsmasq(self):
        """Verify dnsmasq is running."""
        decky.logger.info("Checking if dnsmasq is running...")
        # Check if the process 'dnsmasq' is running
        output = await self.run_command("pgrep -a dnsmasq")

        # If dnsmasq is not running, call the function to start dnsmasq
        if not output:
            decky.logger.error("dnsmasq is NOT running! Restarting...")
            await self.start_dhcp_server()
        else:
            decky.logger.info("dnsmasq is running correctly.")

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

    async def capture_service_states(self):
        """Capture the current state of NetworkManager and iwd before stopping them."""
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

    async def stop_network_services(self):
        """Stop interfering network services."""
        decky.logger.info("Stopping interfering network services...")
        # Stop the NetworkManager and iwd networking services
        await self.run_command("sudo systemctl stop NetworkManager", check=False)
        await self.run_command("sudo systemctl stop iwd", check=False)
        decky.logger.info("Network services stopped.")

    async def allow_broadcast_firewalld(self):
        """Allow broadcast traffic through firewalld for server discovery."""
        decky.logger.info("Allowing broadcast traffic through firewalld...")

        # Allow broadcast to 255.255.255.255
        await self.run_command('sudo firewall-cmd --zone=public --add-rich-rule="rule family=ipv4 destination address=255.255.255.255 protocol value=udp accept" --permanent')
        await self.run_command('sudo firewall-cmd --zone=public --add-rich-rule="rule family=ipv4 destination address=255.255.255.255 protocol value=tcp accept" --permanent')

        # Allow UDP broadcasts from local subnet
        await self.run_command('sudo firewall-cmd --zone=public --add-rich-rule="rule family=ipv4 source address=192.168.8.0/24 protocol value=udp accept" --permanent')

    async def allow_dhcp_firewalld(self):
        """Allow DHCP traffic through firewalld for the correct zone and make it persistent."""
        decky.logger.info("Checking firewalld status...")
        # Check if firewalld is active
        firewalld_status = await self.run_command("sudo systemctl is-active firewalld")
        decky.logger.info(f"Firewalld status: {firewalld_status}")
        
        # If firewalld is not active, skip adding the dhcp rule
        if firewalld_status != "active":
            decky.logger.warning("Firewalld is not active. Skipping DHCP rule addition.")
            return False

        # Identify the active firewall zone ('public' by default)
        active_zone = await self.run_command("sudo firewall-cmd --get-active-zones | awk 'NR==1{print $1}'")
        
        # Failsafe in case the zone could not be determined
        if not active_zone:
            decky.logger.error("Could not determine the active firewalld zone.")
            return False

        decky.logger.info(f"Firewalld is active. Using zone: {active_zone}")

        # Add DHCP service permanently to the firewall ruleset
        error = await self.run_command(f"sudo firewall-cmd --zone={active_zone} --add-service=dhcp --permanent")
        if "success" not in error.lower():
            decky.logger.error(f"Failed to add persistent DHCP service: {error}")
            return False

        # Reload firewalld to apply changes
        error = await self.run_command("sudo firewall-cmd --reload")
        if "success" not in error.lower():
            decky.logger.error(f"Failed to reload firewalld: {error}")
            return False

        decky.logger.info(f"Persistent DHCP service allowed in firewalld (zone: {active_zone}).")
        return True


    async def capture_original_network_config(self):
        """Backup existing IP, gateway, DNS, and WiFi connection."""
        decky.logger.info("Capturing current network settings...")
        # Extract the IP address, gateway and DNS addresses currently set on the WiFi networking device and save to variables
        self.original_ip = await self.extract_ip()
        self.original_gateway = await self.extract_gateway()
        self.original_dns = await self.extract_dns()
        decky.logger.info(f"Captured network config: IP={self.original_ip}, Gateway={self.original_gateway}, DNS={self.original_dns}")

    async def restore_network_config(self):
        """Restore original network settings."""
        decky.logger.info("Restoring original network settings...")

        # Stop the hostapd and dnsmasq services
        decky.logger.info("Stopping hostapd and dnsmasq...")
        await self.run_command("sudo systemctl stop hostapd", check=False)
        await self.run_command("sudo pkill dnsmasq", check=False)

        # Switch the WiFi chip back to managed mode (i.e. regular client mode)
        decky.logger.info("Resetting wlan0 to managed mode...")
        await self.run_command("sudo ip link set wlan0 down", check=False)
        await self.run_command("sudo iw dev wlan0 set type managed", check=False)
        await self.run_command("sudo ip link set wlan0 up", check=False)

        decky.logger.info("Flushing IP configuration...")
        # Wipe out the IP config we defined during initialisation
        await self.run_command(f"sudo ip addr flush dev wlan0", check=False)

        # If we captured an original IP, gateway and DNS address(es) earlier (in function capture_original_network_config), re-apply these to the WiFi chip config
        if self.original_ip:
            decky.logger.info(f"Restoring original IP: {self.original_ip}...")
            # Apply IP settings to the WiFi chip config
            await self.run_command(f"sudo ip addr add {self.original_ip}/24 dev wlan0", check=False)

        if self.original_gateway:
            decky.logger.info(f"Restoring original Gateway: {self.original_gateway}...")
            # Apply default gateway to the WiFi chip config
            await self.run_command(f"sudo ip route add default via {self.original_gateway}", check=False)

        if self.original_dns:
            decky.logger.info(f"Restoring original DNS: {', '.join(self.original_dns)}...")
            # Apply DNS server settings to the WiFi chip config
            await self.set_dns_servers(self.original_dns)

        # Restart network services (NetworkManager and iwd)
        await self.restart_network_services()
        decky.logger.info("Network configuration restored successfully.")

    async def configure_ip(self):
        """Ensure wlan0 gets the correct static IP and keeps it assigned."""
        decky.logger.info("Flushing any existing IP configuration...")
        # Flush the existing IP config from the WiFi chip config
        await self.run_command(f"sudo ip addr flush dev {self.wifi_interface}", check=False)

        """Sets a static IP for the hotspot, ensuring it is not already assigned."""
        decky.logger.info(f"Setting static IP {self.ip_address} on {self.wifi_interface}...")

        # Check to see if the WiFi chip already has the correct static IP for the hotspot
        existing_ip = await self.run_command(f"ip addr show {self.wifi_interface} | grep {self.ip_address}", check=False)

        # If the hotspot IP is present in the wifi config already:
        if existing_ip.strip():
            decky.logger.info(f"IP {self.ip_address} is already assigned to {self.wifi_interface}. Skipping re-assignment.")
        else:
            # Assign the hotspot IP to the WiFi chip config
            await self.run_command(f"sudo ip addr add {self.ip_address}/24 dev {self.wifi_interface}", check=True)
            await asyncio.sleep(1)

        # One last check to make sure the hotspot IP is on the chip
        final_ip_check = await self.run_command(f"ip addr show {self.wifi_interface} | grep {self.ip_address}", check=False)

        # If it isn't:
        if not final_ip_check.strip():
            decky.logger.error(f"Failed to assign IP {self.ip_address} to {self.wifi_interface}.")
        else:
            decky.logger.info(f"Successfully assigned IP {self.ip_address} to {self.wifi_interface}.")


    async def start_wifi_ap(self, ssid, passphrase):
        """Start WiFi Access Point."""
        decky.logger.info("Forcing wlan0 to AP mode...")
        # Take the WiFi chip down, change the WiFi chip mode from managed (i.e. regular client) to AP mode, and bring it back up
        await self.run_command(f"sudo ip link set {self.wifi_interface} down")
        await self.run_command(f"sudo iw dev {self.wifi_interface} set type __ap")
        await self.run_command(f"sudo ip link set {self.wifi_interface} up")

        # If there is an existing hostapd config, remove it
        if os.path.exists("/etc/hostapd/hostapd.conf"):
            decky.logger.info("Removing old hostapd config...")
            os.remove("/etc/hostapd/hostapd.conf")

        decky.logger.info("Generating new hostapd config...")
        # Generate a new hostapd config with the latest parameters
        await self.generate_hostapd_config("/etc/hostapd/hostapd.conf", self.wifi_interface, ssid, passphrase)
        decky.logger.info(f"Starting WiFi Access Point: SSID={ssid}")
        # Start the hotstapd service to bring the hotspot online
        await self.run_command("sudo systemctl restart hostapd", check=True)

    async def start_dhcp_server(self):
        """Start the DHCP server using a fresh dnsmasq config."""

        # Check if dnsmasq config exists. If it does, remove it and regenerate it
        dnsmasq_config = "/tmp/dnsmasq-hotspot.conf"
        if os.path.exists(dnsmasq_config):
            decky.logger.info(f"Removing old dnsmasq config at {dnsmasq_config}...")
            os.remove(dnsmasq_config)

        decky.logger.info("Generating new dnsmasq config...")
        await self.generate_dnsmasq_config(dnsmasq_config, self.wifi_interface, self.dhcp_range, self.ip_address)

        # Stop any running copies of dnsmasq to avoid conflicts
        decky.logger.info("Stopping any existing dnsmasq instances...")
        await self.run_command("sudo pkill dnsmasq", check=False)

        # Start dnsmasq
        decky.logger.info("Starting dnsmasq...")
        await self.run_command(f"sudo dnsmasq -C {dnsmasq_config} 2>&1 &", check=False)

        # Pause for two seconds then check if dnsmasq is running correctly
        await asyncio.sleep(2)
        await self.check_dnsmasq()

    async def extract_ip(self):
        """Extract current IP address."""
        decky.logger.info("Extracting current IP address...")
        ip_output = await self.run_command("ip addr show wlan0")
        match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)/", ip_output)
        ip_address = match.group(1) if match else None
        decky.logger.info(f"Extracted IP: {ip_address}")
        return ip_address

    async def extract_gateway(self):
        """Extract default gateway."""
        decky.logger.info("Extracting default gateway...")
        route_output = await self.run_command("ip route show default")
        match = re.search(r"default via (\d+\.\d+\.\d+\.\d+)", route_output)
        gateway = match.group(1) if match else None
        decky.logger.info(f"Extracted Gateway: {gateway}")
        return gateway

    async def extract_dns(self):
        """Extract current DNS servers."""
        decky.logger.info("Extracting DNS servers...")
        dns_output = await self.run_command("resolvectl status") or await self.run_command("cat /etc/resolv.conf")
        dns_servers = re.findall(r"DNS Servers: ([\d.]+)", dns_output) or re.findall(r"nameserver ([\d.]+)", dns_output)
        decky.logger.info(f"Extracted DNS Servers: {dns_servers}")
        return dns_servers if dns_servers else []

    async def set_dns_servers(self, dns_list):
        """Set DNS servers."""
        decky.logger.info(f"Setting DNS servers: {dns_list}")
        dns_config = "\n".join([f"nameserver {dns}" for dns in dns_list])
        with open("/etc/resolv.conf", "w") as f:
            f.write(dns_config)
        decky.logger.info("DNS servers updated successfully.")

    async def restart_network_services(self):
        """Restart previously active network services."""
        decky.logger.info("Restarting network services...")
        # Restart the NetworkManager and iwd services
        await self.run_command("sudo systemctl restart NetworkManager")
        await self.run_command("sudo systemctl restart iwd")
        decky.logger.info("Network services restarted successfully.")
