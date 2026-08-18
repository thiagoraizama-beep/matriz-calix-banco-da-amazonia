import MultiSelectDropdown from "./MultiSelectDropdown.jsx";

export default function FilterSelect({ value, onChange, placeholder, options }) {
  return (
    <MultiSelectDropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      variant="onImage"
    />
  );
}
