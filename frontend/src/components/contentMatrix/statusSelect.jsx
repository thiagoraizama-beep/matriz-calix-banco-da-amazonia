import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";
import { STATUS_OPTIONS } from "./statusBadge.jsx";

export default function StatusSelect({ value, onChange, disabled }) {
  return (
    <div style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <MultiSelectDropdown
        value={value}
        onChange={(v) => v && onChange(v)}
        options={STATUS_OPTIONS}
        placeholder="Status"
      />
    </div>
  );
}
