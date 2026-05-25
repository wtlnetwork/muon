#!/bin/bash

ZONE_NAME="muon-hotspot"
AP_IF="muon0"

# Remove the muon-hotspot firewalld zone if it exists.
if sudo systemctl is-active --quiet firewalld; then
    if sudo firewall-cmd --get-zones | grep -qw "$ZONE_NAME"; then
        echo "Removing firewalld zone '$ZONE_NAME'..."

        # Remove the interface assignment.
        sudo firewall-cmd --zone="$ZONE_NAME" --remove-interface="$AP_IF" 2>/dev/null || true

        # Delete the permanent zone definition and reload to apply.
        sudo firewall-cmd --permanent --delete-zone="$ZONE_NAME"
        sudo firewall-cmd --reload
        echo "Zone '$ZONE_NAME' removed."
    else
        echo "Zone '$ZONE_NAME' does not exist, skipping firewall cleanup."
    fi
else
    echo "Firewalld not active, skipping firewall cleanup."
fi

rm /var/lib/extensions/muon.raw
systemd-sysext refresh
systemctl restart NetworkManager
