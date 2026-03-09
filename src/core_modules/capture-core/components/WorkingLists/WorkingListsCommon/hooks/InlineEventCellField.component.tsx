import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { orientations } from 'capture-ui';
import { dataElementTypes } from '../../../../metaData';
import { TextField } from '../../../FormFields/New/Fields/TextField/TextField.component';
import { DateField } from '../../../FormFields/New/Fields/DateAndTimeFields/DateField/DateField.component';
import { BooleanField } from '../../../FormFields/New/Fields/BooleanField/BooleanField.component';
import { TrueOnlyField } from '../../../FormFields/New/Fields/TrueOnlyField/TrueOnlyField.component';
import { SingleSelectField } from '../../../FormFields/New/Fields/SingleSelectField/SingleSelectField.component';
import { MultiSelectField } from '../../../FormFields/New/Fields/MultiSelectField/MultiSelectField.component';

type Props = {
    column: {
        id: string;
        type: string;
        options?: Array<{ text: string, value: any }> | null;
    };
    value: any;
    onCommit: (value: any) => void;
    disabled?: boolean;
};

const MULTI_TEXT_SEPARATOR = ',';

const normalizeDateValue = (rawValue: any) => {
    if (!rawValue || typeof rawValue !== 'string') {
        return rawValue ?? null;
    }

    // Handles values like 2026-03-01T22:00:00.000 and keeps only date for date fields.
    if (rawValue.includes('T')) {
        return rawValue.split('T')[0];
    }

    return rawValue;
};

export const InlineEventCellField = React.memo(({
    column,
    value,
    onCommit,
    disabled,
}: Props) => {
    const [localValue, setLocalValue] = useState<any>(value ?? null);

    useEffect(() => {
        setLocalValue(value ?? null);
    }, [value, column.id]);

    const optionSetOptions = useMemo(
        () => (column.options || []).map(option => ({
            value: option.value,
            label: option.text,
            id: String(option.value),
        })),
        [column.options],
    );

    const commit = useCallback((nextValue: any) => {
        if (disabled) {
            return;
        }
        setLocalValue(nextValue);
        onCommit(nextValue);
    }, [onCommit, disabled]);

    const commonStyle = { minWidth: 180 };

    if (column.options && column.type !== dataElementTypes.MULTI_TEXT) {
        return (
            <div style={commonStyle}>
                <SingleSelectField
                    options={optionSetOptions}
                    value={localValue ?? null}
                    onChange={setLocalValue}
                    onBlur={commit}
                    clearable
                    disabled={disabled}
                />
            </div>
        );
    }

    if (column.type === dataElementTypes.MULTI_TEXT) {
        const multiValue = Array.isArray(localValue)
            ? localValue.join(MULTI_TEXT_SEPARATOR)
            : (localValue ?? '');

        return (
            <div style={commonStyle}>
                <MultiSelectField
                    options={optionSetOptions}
                    value={multiValue}
                    onSelect={setLocalValue}
                    onBlur={commit}
                    disabled={disabled}
                />
            </div>
        );
    }

    if (column.type === dataElementTypes.DATE) {
        const normalizedDateValue = normalizeDateValue(localValue);
        return (
            <div style={commonStyle}>
                <DateField
                    value={normalizedDateValue ?? null}
                    onBlur={commit}
                    orientation={orientations.HORIZONTAL}
                    width={180}
                    disabled={disabled}
                />
            </div>
        );
    }

    if (column.type === dataElementTypes.BOOLEAN) {
        return (
            <div>
                <BooleanField
                    value={localValue}
                    onBlur={commit}
                    disabled={disabled}
                />
            </div>
        );
    }

    if (column.type === dataElementTypes.TRUE_ONLY) {
        return (
            <div>
                <TrueOnlyField
                    value={localValue}
                    onBlur={commit}
                    disabled={disabled}
                />
            </div>
        );
    }

    return (
        <div style={commonStyle}>
            <TextField
                value={localValue ?? ''}
                onChange={setLocalValue}
                onBlur={commit}
                disabled={disabled}
            />
        </div>
    );
});
