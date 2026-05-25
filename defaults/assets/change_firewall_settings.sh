#!/bin/bash

# Full IP Address (e.g. 192.168.8.1)
IP_ADDRESS=$1
ZONE_NAME="muon-hotspot"
AP_IF="muon0"

echo "Configuring firewalld for hotspot on $AP_IF (IP: $IP_ADDRESS)..."

# Check if firewalld is active
FIREWALLD_STATUS=$(sudo systemctl is-active firewalld)
echo "Firewalld status: $FIREWALLD_STATUS"

if [ "$FIREWALLD_STATUS" != "active" ]; then
    echo "Firewalld is not active. Exiting."
    exit 1
fi

# Create a custom zone for the hotspot called 'muon-hotspot' if it doesn't already exist.
# When the hotspot is not active, the zone will be inert, as no active devices will be assigned to it.
if ! sudo firewall-cmd --get-zones | grep -qw "$ZONE_NAME"; then
    echo "Creating permanent zone '$ZONE_NAME'..."
    sudo firewall-cmd --permanent --new-zone="$ZONE_NAME"
    # Allow all traffic within the zone. This will allow uninhibited communication between all devices connected to the hotspot.
    sudo firewall-cmd --permanent --zone="$ZONE_NAME" --set-target=ACCEPT
    sudo firewall-cmd --reload
    echo "Zone '$ZONE_NAME' created."
else
    echo "Zone '$ZONE_NAME' already exists."
fi

# Bind the muon0 interface to the muon-hotspot zone. Permanent setting is fine as it only applies to the muon0 interface.
echo "Binding $AP_IF to zone '$ZONE_NAME'..."
sudo firewall-cmd --permanent --zone="$ZONE_NAME" --add-interface="$AP_IF"

# Enable masquerading - this will only be useful if we decide to integrate internet sharing. No plans for this, but worth setting in case.
echo "Enabling masquerade on zone '$ZONE_NAME'..."
sudo firewall-cmd --permanent --zone="$ZONE_NAME" --add-masquerade

# Allow DHCP service.
echo "Allowing DHCP on zone '$ZONE_NAME'..."
sudo firewall-cmd --permanent --zone="$ZONE_NAME" --add-service=dhcp

echo "Reloading firewalld to apply changes to running configuration..."
sudo firewall-cmd --reload

echo "Firewalld configured successfully."
exit 0
