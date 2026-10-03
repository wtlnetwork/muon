#!/bin/bash

IP_ADDRESS=$1
ZONE_NAME="muon-hotspot"
AP_IF="muon0"

echo "Configuring firewalld for hotspot on $AP_IF (IP: $IP_ADDRESS)..."

FIREWALLD_STATUS=$(sudo systemctl is-active firewalld)
echo "Firewalld status: $FIREWALLD_STATUS"

if [ "$FIREWALLD_STATUS" != "active" ]; then
    echo "Firewalld is not active. Exiting."
    exit 1
fi

# Create zone if necessary.
if ! sudo firewall-cmd --get-zones | grep -qw "$ZONE_NAME"; then
    echo "Creating permanent zone '$ZONE_NAME'..."
    sudo firewall-cmd --permanent --new-zone="$ZONE_NAME"
fi

# Always enforce a completely permissive zone target.
echo "Setting '$ZONE_NAME' target to ACCEPT..."
sudo firewall-cmd --permanent \
    --zone="$ZONE_NAME" \
    --set-target=ACCEPT

# Assign muon0 permanently.
echo "Assigning $AP_IF to '$ZONE_NAME' permanently..."
sudo firewall-cmd --permanent \
    --zone="$ZONE_NAME" \
    --change-interface="$AP_IF"

# DHCP is explicitly allowed even though ACCEPT should already permit traffic.
echo "Allowing DHCP..."
sudo firewall-cmd --permanent \
    --zone="$ZONE_NAME" \
    --add-service=dhcp

# Keep masquerading enabled for future routed/internet-sharing use.
echo "Enabling masquerading..."
sudo firewall-cmd --permanent \
    --zone="$ZONE_NAME" \
    --add-masquerade

# Apply permanent configuration.
echo "Reloading firewalld..."
sudo firewall-cmd --reload

# Explicitly ensure muon0 is assigned to the correct zone at runtime too.
echo "Ensuring runtime assignment of $AP_IF..."
sudo firewall-cmd \
    --zone="$ZONE_NAME" \
    --change-interface="$AP_IF"

# Explicit runtime target as well.
sudo firewall-cmd \
    --zone="$ZONE_NAME" \
    --set-target=ACCEPT

# Verify what we actually ended up with.
ACTIVE_ZONE=$(sudo firewall-cmd --get-zone-of-interface="$AP_IF")

echo "Runtime zone for $AP_IF: $ACTIVE_ZONE"

if [ "$ACTIVE_ZONE" != "$ZONE_NAME" ]; then
    echo "ERROR: $AP_IF is in '$ACTIVE_ZONE', expected '$ZONE_NAME'."
    exit 1
fi

echo "Final runtime firewall configuration:"
sudo firewall-cmd --zone="$ZONE_NAME" --list-all

echo "Firewalld configured successfully."
exit 0