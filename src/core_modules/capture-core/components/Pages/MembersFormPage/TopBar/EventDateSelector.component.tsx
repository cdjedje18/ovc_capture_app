import React, { useMemo, useState } from 'react';
// @ts-expect-error - SelectorBarItem is available at runtime, but its TypeScript definition is not exposed by the UI library
import { Menu, MenuItem, SelectorBarItem } from '@dhis2/ui';

type Props = {
    selectedValue?: string;
    options: Array<{
        value: string;
        label: string;
    }>;
    onSelect: (value: string | undefined) => void;
};

export const EventDateSelector = ({
    selectedValue,
    options,
    onSelect,
}: Props) => {
    const [open, setOpen] = useState(false);

    const selectedLabel = useMemo(
        () => options.find(option => option.value === selectedValue)?.label || selectedValue || '',
        [options, selectedValue],
    );

    return (
        <SelectorBarItem
            label="Data da visita"
            value={selectedLabel}
            noValueMessage="Escolha a data"
            open={open}
            setOpen={setOpen}
            onClearSelectionClick={() => onSelect(undefined)}
        >
            <Menu>
                {options.map(option => (
                    <MenuItem
                        key={option.value}
                        label={option.label}
                        value={option.value}
                        onClick={({ value }) => {
                            onSelect(value);
                            setOpen(false);
                        }}
                    />
                ))}
            </Menu>
        </SelectorBarItem>
    );
};
