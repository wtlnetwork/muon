import os
import asyncio
import decky
import subprocess
import re

class Plugin:
    def __init__(self):
        self.wifi_interface = "wlan0"
        self.ip_address = "192.168.8.1"
        self.dhcp_range = "192.168.8.100,192.168.8.200,12h"
        self.ssid = "SteamDeck-Hotspot"
        self.passphrase = "MySecurePass"
        self.hotspot_active = False

    async def _main(self):
        decky.logger.info("Hotspot Plugin Loaded")

    async def _unload(self):
        decky.logger.info("Stopping Hotspot Plugin")
        if self.hotspot_active:
            await self.stop_hotspot()
        decky.logger.info("Plugin Unloaded")

    async def run_command(self, command: str, check: bool = False):
        decky.logger.info(f"Executing command: {command}")
        result = await asyncio.create_subprocess_shell(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        stdout, stderr = await result.communicate()
        decky.logger.info(f"Command output: {stdout.decode().strip()}")
        decky.logger.error(f"Command error: {stderr.decode().strip()}") if stderr else None
        return stdout.decode().strip()

    async def start_hotspot(self):
        decky.logger.info("Starting Hotspot")
        try:
            await self.check_dependencies()
            await self.allow_dhcp_firewalld()
            await self.ensure_wlan0_up()
            await self.capture_original_network_config()
            await self.capture_service_states()
            await self.stop_network_services()
            await self.configure_ip()
            await self.start_wifi_ap()
            await self.start_dhcp_server()
            self.hotspot_active = True
            decky.logger.info("Hotspot is active")
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

    async def check_dependencies(self):
        """Ensure required dependencies are installed."""
        for dep in ["dnsmasq", "hostapd"]:
            decky.logger.info(f"Checking for dependency: {dep}")
            result = await self.run_command(f"which {dep}")
            if not result:
                decky.logger.error(f"❌ ERROR: `{dep}` is not installed.")
                raise Exception(f"{dep} is missing.")
        decky.logger.info("✅ All dependencies are installed.")

    async def ensure_wlan0_up(self):
        """Ensure the wlan0 interface is available and up."""
        decky.logger.info("Checking wlan0 status...")
        result = await self.run_command("ip link show wlan0")
        decky.logger.info(f"wlan0 status: {result}")
        if "state DOWN" in result:
            decky.logger.info("⚠️ wlan0 is down. Bringing it up...")
            await self.run_command("sudo ip link set wlan0 up")
        elif "state UNKNOWN" in result:
            decky.logger.error("❌ wlan0 interface not found. Check your WiFi adapter.")
            raise Exception("wlan0 interface not found.")

    async def stop_network_services(self):
        """Stop interfering network services."""
        decky.logger.info("Stopping interfering network services...")
        await self.run_command("sudo systemctl stop NetworkManager", check=False)
        await self.run_command("sudo systemctl stop iwd", check=False)
        decky.logger.info("✅ Network services stopped.")

    async def allow_dhcp_firewalld(self):
        """Allow DHCP traffic through firewalld for the correct zone."""
        decky.logger.info("🔄 Checking firewalld status...")
        firewalld_status = await self.run_command("sudo systemctl is-active firewalld")
        decky.logger.info(f"Firewalld status: {firewalld_status}")
        if firewalld_status != "active":
            decky.logger.warning("⚠️ Firewalld is not active. Skipping DHCP rule addition.")
            return False

        active_zone = await self.run_command("sudo firewall-cmd --get-active-zones | awk 'NR==1{print $1}'")
        if not active_zone:
            decky.logger.error("❌ Could not determine the active firewalld zone.")
            return False

        decky.logger.info(f"✅ Firewalld is active. Using zone: {active_zone}")

        error = await self.run_command(f"sudo firewall-cmd --zone={active_zone} --add-service=dhcp")
        if "success" not in error.lower():
            decky.logger.error(f"❌ Failed to add DHCP service: {error}")
            return False

        error = await self.run_command("sudo firewall-cmd --reload")
        if "success" not in error.lower():
            decky.logger.error(f"❌ Failed to reload firewalld: {error}")
            return False

        decky.logger.info(f"🚀 DHCP service allowed in firewalld (zone: {active_zone}).")
        return True

    async def capture_original_network_config(self):
        """Backup existing IP, gateway, DNS, and WiFi connection."""
        decky.logger.info("📡 Capturing current network settings...")
        self.original_ip = await self.extract_ip()
        self.original_gateway = await self.extract_gateway()
        self.original_dns = await self.extract_dns()
        decky.logger.info(f"Captured network config: IP={self.original_ip}, Gateway={self.original_gateway}, DNS={self.original_dns}")

    async def restore_network_config(self):
        """Restore original network settings."""
        decky.logger.info("🔄 Restoring original network settings...")

        decky.logger.info("🛑 Stopping hostapd and dnsmasq...")
        await self.run_command("sudo systemctl stop hostapd", check=False)
        await self.run_command("sudo pkill dnsmasq", check=False)

        decky.logger.info("🔄 Resetting wlan0 to managed mode...")
        await self.run_command("sudo ip link set wlan0 down", check=False)
        await self.run_command("sudo iw dev wlan0 set type managed", check=False)
        await self.run_command("sudo ip link set wlan0 up", check=False)

        decky.logger.info("🧹 Flushing IP configuration...")
        await self.run_command(f"sudo ip addr flush dev wlan0", check=False)

        if self.original_ip:
            decky.logger.info(f"🌍 Restoring original IP: {self.original_ip}...")
            await self.run_command(f"sudo ip addr add {self.original_ip}/24 dev wlan0", check=False)

        if self.original_gateway:
            decky.logger.info(f"🌍 Restoring original Gateway: {self.original_gateway}...")
            await self.run_command(f"sudo ip route add default via {self.original_gateway}", check=False)

        if self.original_dns:
            decky.logger.info(f"🌍 Restoring original DNS: {', '.join(self.original_dns)}...")
            await self.set_dns_servers(self.original_dns)

        await self.restart_network_services()
        decky.logger.info("✅ Network configuration restored successfully.")

    async def configure_ip(self):
        """Ensure wlan0 gets the correct static IP and keeps it assigned."""
        decky.logger.info("🧹 Flushing any existing IP configuration...")
        await self.run_command(f"sudo ip addr flush dev {self.wifi_interface}", check=False)

        decky.logger.info(f"🌍 Setting static IP {self.ip_address} on {self.wifi_interface}...")
        await self.run_command(f"sudo ip addr add {self.ip_address}/24 dev {self.wifi_interface}", check=True)
        await asyncio.sleep(1)  # Small delay
        await self.run_command(f"sudo ip addr add {self.ip_address}/24 dev {self.wifi_interface}", check=False)

        ip_check = await self.run_command(f"ip addr show {self.wifi_interface}")
        if self.ip_address not in ip_check:
            decky.logger.error(f"❌ wlan0 does NOT have the correct IP ({self.ip_address}). Retrying...")
            await asyncio.sleep(1)
            await self.run_command(f"sudo ip addr add {self.ip_address}/24 dev {self.wifi_interface}", check=True)

        ip_check = await self.run_command(f"ip addr show {self.wifi_interface}")
        if self.ip_address not in ip_check:
            decky.logger.error(f"❌ wlan0 is still missing {self.ip_address}. Something is wrong!")
            raise Exception(f"Failed to set static IP {self.ip_address} on {self.wifi_interface}")
        else:
            decky.logger.info(f"✅ wlan0 successfully set to {self.ip_address}")

    async def start_wifi_ap(self):
        """Start WiFi Access Point."""
        decky.logger.info("⚙️ Forcing wlan0 to AP mode...")
        await self.run_command(f"sudo ip link set {self.wifi_interface} down")
        await self.run_command(f"sudo iw dev {self.wifi_interface} set type __ap")
        await self.run_command(f"sudo ip link set {self.wifi_interface} up")

        if os.path.exists("/etc/hostapd/hostapd.conf"):
            decky.logger.info("🗑️ Removing old hostapd config...")
            os.remove("/etc/hostapd/hostapd.conf")

        decky.logger.info("📝 Generating new hostapd config...")
        await self.generate_hostapd_config("/etc/hostapd/hostapd.conf", self.wifi_interface, self.ssid, self.passphrase)

        decky.logger.info(f"🚀 Starting WiFi Access Point: SSID={self.ssid}")
        await self.run_command("sudo systemctl restart hostapd", check=True)

    async def start_dhcp_server(self):
        """Start the DHCP server using a fresh dnsmasq config."""
        dnsmasq_config = "/tmp/dnsmasq-hotspot.conf"
        if os.path.exists(dnsmasq_config):
            decky.logger.info(f"🗑️ Removing old dnsmasq config at {dnsmasq_config}...")
            os.remove(dnsmasq_config)

        decky.logger.info("📝 Generating new dnsmasq config...")
        await self.generate_dnsmasq_config(dnsmasq_config, self.wifi_interface, self.dhcp_range, self.ip_address)

        decky.logger.info("🛠️ Stopping any existing dnsmasq instances...")
        await self.run_command("sudo pkill dnsmasq", check=False)

        decky.logger.info("🚀 Starting dnsmasq...")
        await self.run_command(f"sudo dnsmasq -C {dnsmasq_config} 2>&1 &", check=False)

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
        decky.logger.info("✅ DNS servers updated successfully.")

    async def restart_network_services(self):
        """Restart previously active network services."""
        decky.logger.info("🔄 Restarting network services...")
        await self.run_command("sudo systemctl restart NetworkManager")
        await self.run_command("sudo systemctl restart iwd")
        decky.logger.info("✅ Network services restarted successfully.")
