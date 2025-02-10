import os
import asyncio
import decky
import subprocess

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
        for dep in ["dnsmasq", "hostapd"]:
            result = await self.run_command(f"which {dep}")
            if not result:
                decky.logger.error(f"{dep} is not installed.")
                raise Exception(f"{dep} is missing.")

    async def ensure_wlan0_up(self):
        decky.logger.info("Checking wlan0 status...")
        result = await self.run_command("ip link show wlan0")
        decky.logger.info(f"wlan0 status: {result}")
        if "state DOWN" in result:
            await self.run_command("sudo ip link set wlan0 up")
        elif "state UNKNOWN" in result:
            raise Exception("wlan0 interface not found.")

    async def stop_network_services(self):
        decky.logger.info("Stopping interfering network services...")
        await self.run_command("sudo systemctl stop NetworkManager")
        await self.run_command("sudo systemctl stop iwd")

    async def allow_dhcp_firewalld(self):
        decky.logger.info("Configuring firewalld for DHCP...")
        firewalld_status = await self.run_command("sudo systemctl is-active firewalld")
        decky.logger.info(f"Firewalld status: {firewalld_status}")
        if firewalld_status != "active":
            return
        active_zone = await self.run_command("sudo firewall-cmd --get-active-zones | awk 'NR==1{print $1}'")
        await self.run_command(f"sudo firewall-cmd --zone={active_zone} --add-service=dhcp")
        await self.run_command("sudo firewall-cmd --reload")

    async def capture_original_network_config(self):
        decky.logger.info("Capturing current network settings...")
        self.original_ip = await self.extract_ip()
        self.original_gateway = await self.extract_gateway()
        self.original_dns = await self.extract_dns()

    async def restore_network_config(self):
        decky.logger.info("Restoring original network settings...")
        await self.run_command("sudo systemctl stop hostapd")
        await self.run_command("sudo pkill dnsmasq")
        await self.run_command("sudo ip link set wlan0 down")
        await self.run_command("sudo iw dev wlan0 set type managed")
        await self.run_command("sudo ip link set wlan0 up")
        if self.original_ip:
            await self.run_command(f"sudo ip addr add {self.original_ip}/24 dev wlan0")
        if self.original_gateway:
            await self.run_command(f"sudo ip route add default via {self.original_gateway}")
        if self.original_dns:
            await self.set_dns_servers(self.original_dns)
        await self.restart_network_services()

    async def configure_ip(self):
        decky.logger.info(f"Configuring IP: {self.ip_address}")
        await self.run_command(f"sudo ip addr flush dev {self.wifi_interface}")
        await self.run_command(f"sudo ip addr add {self.ip_address}/24 dev {self.wifi_interface}")

    async def start_wifi_ap(self):
        decky.logger.info("Configuring WiFi interface for AP mode...")
        await self.run_command(f"sudo ip link set {self.wifi_interface} down")
        await self.run_command(f"sudo iw dev {self.wifi_interface} set type __ap")
        await self.run_command(f"sudo ip link set {self.wifi_interface} up")
        decky.logger.info("Restarting hostapd service...")
        await self.run_command("sudo systemctl restart hostapd")

    async def start_dhcp_server(self):
        decky.logger.info("Starting DHCP server...")
        await self.run_command("sudo pkill dnsmasq")
        await self.run_command(f"sudo dnsmasq -C /tmp/dnsmasq-hotspot.conf 2>&1 &")
        decky.logger.info("DHCP server started successfully.")

    async def extract_ip(self):
        decky.logger.info("Extracting IP address...")
        ip_output = await self.run_command("ip addr show wlan0")
        ip_address = ip_output.split()[1] if ip_output else None
        decky.logger.info(f"Extracted IP: {ip_address}")
        return ip_address

    async def extract_gateway(self):
        decky.logger.info("Extracting default gateway...")
        route_output = await self.run_command("ip route show default")
        gateway = route_output.split()[2] if route_output else None
        decky.logger.info(f"Extracted Gateway: {gateway}")
        return gateway

    async def extract_dns(self):
        decky.logger.info("Extracting DNS servers...")
        dns_output = await self.run_command("resolvectl status")
        dns_servers = dns_output.split() if dns_output else []
        decky.logger.info(f"Extracted DNS Servers: {dns_servers}")
        return dns_servers

    async def set_dns_servers(self, dns_list):
        decky.logger.info(f"Setting DNS servers: {dns_list}")
        dns_config = "\n".join([f"nameserver {dns}" for dns in dns_list])
        with open("/etc/resolv.conf", "w") as f:
            f.write(dns_config)
        decky.logger.info("DNS servers updated successfully.")

    async def restart_network_services(self):
        decky.logger.info("Restarting network services...")
        await self.run_command("sudo systemctl restart NetworkManager")
        await self.run_command("sudo systemctl restart iwd")
        decky.logger.info("Network services restarted successfully.")