#!/bin/bash

EXTENSION_NAME="muon-network-tools"
EXTENSION_PATH="/var/lib/extensions/$EXTENSION_NAME.raw"

echo "Checking if the $EXTENSION_NAME extension is present and attached..."

# Check if the extension file exists
if [ ! -f "$EXTENSION_PATH" ]; then
    echo "Error: $EXTENSION_NAME extension is missing!"
    exit 1
fi

# Check if the extension is attached
if systemd-sysext status | grep -q "$EXTENSION_NAME"; then
    echo "$EXTENSION_NAME extension is already attached."
else
    echo "Attaching $EXTENSION_NAME extension..."
    systemd-sysext refresh

    # Verify it was successfully attached
    if systemd-sysext status | grep -q "$EXTENSION_NAME"; then
        echo "$EXTENSION_NAME extension attached successfully!"
        exit 0
    else
        echo "Error: Failed to attach $EXTENSION_NAME extension!"
        exit 1
    fi
fi