import React from 'react';
import { POINT_MENU, PointMenuItem } from '../constants';
import { presetsByCategory, presetPointsLabel, capPeriodLabel } from '../utils/pointMenu';

// Dropdown of the Official BPLT Incentive Framework point menu, grouped by
// category. Picking one hands the preset back so the form can prefill
// category/points/reason; "Custom" leaves the form as-is for one-offs.
export const PointPresetSelect: React.FC<{
    value: string; // preset key, '' = custom
    onChange: (preset: PointMenuItem | null) => void;
    className?: string;
}> = ({ value, onChange, className }) => (
    <select
        aria-label="Point preset"
        className={className || 'w-full border p-2 rounded'}
        value={value}
        onChange={e => onChange(POINT_MENU.find(p => p.key === e.target.value) || null)}
    >
        <option value="">Custom (type your own)</option>
        {presetsByCategory().map(g => (
            <optgroup key={g.category} label={g.category}>
                {g.items.map(p => (
                    <option key={p.key} value={p.key}>
                        {p.label} ({presetPointsLabel(p)} pts{p.cap ? `, max ${capPeriodLabel(p)}` : ''})
                    </option>
                ))}
            </optgroup>
        ))}
    </select>
);
