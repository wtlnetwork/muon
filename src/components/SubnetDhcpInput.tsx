import { PanelSectionRow, TextField, Field } from "@decky/ui";
import { useState } from "react";

interface SubnetDhcpInputProps {
  baseIp: string;
  onChange: (fullBaseIp: string, dhcpStart: string, dhcpEnd: string) => void;
  error?: string;
}

export const SubnetDhcpInput = ({ baseIp, onChange, error }: SubnetDhcpInputProps) => {
  const [octets, setOctets] = useState(baseIp.split(".").map((o) => o || ""));
  const [start, setStart] = useState("100");
  const [end, setEnd] = useState("200");

  const handleOctetChange = (index: number, value: string) => {
    if (!/^[0-9]{0,3}$/.test(value)) return;
    const val = Math.min(255, parseInt(value || "0"));
    const newOctets = [...octets];
    newOctets[index] = val.toString();
    setOctets(newOctets);
    onChange(
      newOctets.join("."),
      `${newOctets.slice(0, 3).join(".")}.${start}`,
      `${newOctets.slice(0, 3).join(".")}.${end}`
    );
  };

  const handleRangeChange = (setter: (v: string) => void, value: string, which: "start" | "end") => {
    if (!/^[0-9]{0,3}$/.test(value)) return;
    const val = Math.min(255, parseInt(value || "0"));
    setter(val.toString());
    onChange(
      octets.join("."),
      `${octets.slice(0, 3).join(".")}.${which === "start" ? val : start}`,
      `${octets.slice(0, 3).join(".")}.${which === "end" ? val : end}`
    );
  };

  return (
    <>
    <PanelSectionRow>
    <Field label="Base IP Address">
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        {octets.slice(0, 3).map((octet, i) => (
            <TextField
            key={i}
            value={octet}
            mustBeNumeric
            rangeMin={0}
            rangeMax={255}
            style={{ width: 50 }}
            onChange={(e) => handleOctetChange(i, e.target.value)}
            />
        ))}
        <span>.</span>
        <TextField
            value={octets[3]}
            mustBeNumeric
            rangeMin={1}
            rangeMax={254}
            style={{ width: 50 }}
            onChange={(e) => handleOctetChange(3, e.target.value)}
        />
        </div>
    </Field>
    </PanelSectionRow>

    <PanelSectionRow>
    <Field label="DHCP Range (last octet only)">
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <span>{octets[0]}</span>
        <span>.</span>
        <span>{octets[1]}</span>
        <span>.</span>
        <span>{octets[2]}</span>
        <span>.</span>
        <TextField
            value={start}
            mustBeNumeric
            rangeMin={1}
            rangeMax={254}
            style={{ width: 50 }}
            onChange={(e) => handleRangeChange(setStart, e.target.value, "start")}
        />
        <span>-</span>
        <TextField
            value={end}
            mustBeNumeric
            rangeMin={1}
            rangeMax={254}
            style={{ width: 50 }}
            onChange={(e) => handleRangeChange(setEnd, e.target.value, "end")}
        />
        </div>
    </Field>
    </PanelSectionRow>
      {error && (
        <PanelSectionRow>
          <p style={{ color: "red" }}>{error}</p>
        </PanelSectionRow>
      )}
    </>
  );
};