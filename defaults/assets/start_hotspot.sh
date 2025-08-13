#!/bin/bash

# Input Parameters
WIFI_INTERFACE=$1
STATIC_IP=$2
SSID=$3
PASSPHRASE=$4

CON_NAME="$(echo "$SSID" | sed 's/[^[:alnum:]]/_/g' | sed 's/_\+/_/g' | sed 's/^_//; s/_$//')"
# Backup connection name if the SSID is absent for whatever reason
if [ -z "$CON_NAME" ]; then
  CON_NAME="muon_ap"
fi

echo "Starting hotspot setup..."
echo "WiFi Interface: $WIFI_INTERFACE"
echo "Static IP: $STATIC_IP"
echo "SSID: $SSID"
echo "Passphrase: $PASSPHRASE"

# Ensure that the WiFi radio is available
rfkill unblock all
nmcli radio wifi on

# Check if a previous AP profile exists and remove it if it does
if nmcli -t -f NAME con show | grep -Fxq "$CON_NAME"; then
  nmcli con down "$CON_NAME"
  nmcli con del "$CON_NAME"
fi

# Configure hotspot interface
nmcli con add type wifi ifname "$WIFI_INTERFACE" con-name "$CON_NAME" ssid "$SSID"
nmcli con modify "$CON_NAME" \
  802-11-wireless.mode ap \
  802-11-wireless.band bg \
  802-11-wireless.hidden no \
  wifi-sec.key-mgmt wpa-psk \
  wifi-sec.psk "$PASSPHRASE" \
  ipv4.method shared \
  ipv4.addresses "${STATIC_IP}/24" \
  ipv4.never-default yes \
  ipv6.method ignore

# Bring the hotspot interface up
nmcli con up "$CON_NAME"

if [ $? -eq 0 ]; then
  echo "Hotspot '$SSID' started successfully with static IP $STATIC_IP."
else
  echo "Failed to start hotspot '$SSID'."
  exit 1
fi