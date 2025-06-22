#!/bin/bash

INSTALL_DNSMASQ=$1
INSTALL_HOSTAPD=$2
BIN_DIR="/home/deck/homebrew/plugins/muon/backend/bin"
PKG_CACHE="/tmp/pkgcache"

mkdir -p "$PKG_CACHE"
mkdir -p "$BIN_DIR"

echo "Will extract hostapd: $INSTALL_HOSTAPD"
echo "Will extract dnsmasq: $INSTALL_DNSMASQ"
echo "Target bin directory: $BIN_DIR"

get_package_url() {
    local pkg="$1"
    local base_url="https://steamdeck-packages.steamos.cloud/archlinux-mirror"

    local repo=$(pacman -Si "$pkg" | grep '^Repository' | awk '{print $3}')
    local version=$(pacman -Si "$pkg" | grep '^Version' | awk '{print $3}')
    local arch=$(pacman -Si "$pkg" | grep '^Architecture' | awk '{print $3}')

    local filename="${pkg}-${version}-${arch}.pkg.tar.zst"
    echo "$base_url/$repo/os/$arch/$filename"
}

download_and_extract_bin() {
    local pkg="$1"
    echo "Resolving and downloading $pkg..."

    local url
    url=$(get_package_url "$pkg")
    local file="$PKG_CACHE/$(basename "$url")"

    echo "Download URL: $url"
    echo "Saving to: $file"

    curl -L "$url" -o "$file"
    if [ $? -ne 0 ]; then
        echo "Failed to download $pkg"
        return 1
    fi

    echo "Extracting binaries from $pkg..."
    case "$pkg" in
        hostapd)
            bsdtar -xpf "$file" -C "$BIN_DIR" --strip-components=2 \
                ./usr/bin/hostapd ./usr/bin/hostapd_cli
            ;;
        dnsmasq)
            bsdtar -xpf "$file" -C "$BIN_DIR" --strip-components=2 \
                ./usr/bin/dnsmasq
            ;;
        *)
            echo "Unhandled package: $pkg"
            return 1
            ;;
    esac
}

ERROR=false

if [ "$INSTALL_DNSMASQ" == "true" ]; then
    download_and_extract_bin dnsmasq || ERROR=true
fi

if [ "$INSTALL_HOSTAPD" == "true" ]; then
    download_and_extract_bin hostapd || ERROR=true
fi

if [ "$ERROR" == "true" ]; then
    echo "One or more binaries failed to extract."
    exit 1
else
    echo "Binaries placed in $BIN_DIR:"
    ls -l "$BIN_DIR"
    chown -R deck:deck "$BIN_DIR"
    exit 0
fi