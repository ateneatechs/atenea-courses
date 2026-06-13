import React from 'react';
import './ToggleSwitch.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const ToggleSwitch: React.FC<Props> = ({ checked, onChange, disabled, label }) => (
  <label className={`toggle-switch${disabled ? ' disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
    />
    <span className="toggle-switch-track">
      <span className="toggle-switch-knob" />
    </span>
    {label && <span className="toggle-switch-label">{label}</span>}
  </label>
);

export default ToggleSwitch;
