#!/bin/bash

# Full IP Address (e.g. 192.168.8.1)
IP_ADDRESS=$1

echo "Configuring firewalld for IP address: $IP_ADDRESS"

# Extract subnet from IP Address (e.g. 192.168.8.1 -> 192.168.8.0)
SUBNET=$(echo "$IP_ADDRESS" | sed 's/\.[0-9]\+$/\.0/')
echo "Extracted Subnet: $SUBNET/24"

# Check if firewalld is active
FIREWALLD_STATUS=$(sudo systemctl is-active firewalld)
echo "Firewalld status: $FIREWALLD_STATUS"

if [ "$FIREWALLD_STATUS" != "active" ]; then
    echo "Firewalld is not active. Exiting."
    exit 1
fi

# Get the active zone, default to 'public' if not found
ACTIVE_ZONE=$(sudo firewall-cmd --get-active-zones | awk 'NR==1{print $1}')
if [ -z "$ACTIVE_ZONE" ]; then
    echo "Could not determine the active firewalld zone. Using default: public"
    ACTIVE_ZONE="public"
fi
echo "Using firewalld zone: $ACTIVE_ZONE"

# Allow broadcast traffic and UDP for server discovery
echo "Allowing broadcast traffic for server discovery..."
sudo firewall-cmd --zone=$ACTIVE_ZONE --add-rich-rule="rule family=ipv4 destination address=255.255.255.255 protocol value=udp accept" --permanent
sudo firewall-cmd --zone=$ACTIVE_ZONE --add-rich-rule="rule family=ipv4 destination address=255.255.255.255 protocol value=tcp accept" --permanent
sudo firewall-cmd --zone=$ACTIVE_ZONE --add-rich-rule="rule family=ipv4 source address=${SUBNET}/24 protocol value=udp accept" --permanent

# Allow DHCP service
echo "Allowing DHCP traffic..."
sudo firewall-cmd --zone=$ACTIVE_ZONE --add-service=dhcp --permanent

# Reload firewalld to apply changes
echo "Reloading firewalld to apply changes..."
FIREWALLD_RELOAD=$(sudo firewall-cmd --reload)

if [ "$FIREWALLD_RELOAD" == "success" ]; then
    echo "Firewalld configuration updated successfully."
    exit 0
else
    echo "Failed to reload firewalld."
    exit 1
fi
