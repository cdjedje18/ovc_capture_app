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
        disabled?: boolean
        value?: any
        rowChanged?: string
        required?: boolean
    };
    value: any;
    onCommit: (value: any, handledByRule?: boolean) => void;
    disabled?: boolean;
    saveStatus?: 'idle' | 'saving' | 'success' | 'error';
};

const MULTI_TEXT_SEPARATOR = ',';
const NUMBER_TYPES = new Set([
    dataElementTypes.NUMBER,
    dataElementTypes.INTEGER,
    dataElementTypes.INTEGER_POSITIVE,
    dataElementTypes.INTEGER_NEGATIVE,
    dataElementTypes.INTEGER_ZERO_OR_POSITIVE,
]);

const isValidNumericDraft = (value: string, type: string) => {
    if (!NUMBER_TYPES.has(type as any)) {
        return true;
    }

    if (value === '') {
        return true;
    }

    switch (type) {
        case dataElementTypes.NUMBER:
            return /^-?\d*(?:[.]\d*)?$/.test(value);
        case dataElementTypes.INTEGER:
            return /^-?\d*$/.test(value);
        case dataElementTypes.INTEGER_POSITIVE:
            return /^\d*$/.test(value) && value !== '0';
        case dataElementTypes.INTEGER_NEGATIVE:
            return /^-\d*$/.test(value);
        case dataElementTypes.INTEGER_ZERO_OR_POSITIVE:
            return /^\d*$/.test(value);
        default:
            return true;
    }
};

const isValidNumericCommit = (value: string, type: string) => {
    if (!NUMBER_TYPES.has(type as any)) {
        return true;
    }

    if (value === '') {
        return true;
    }

    switch (type) {
        case dataElementTypes.NUMBER:
            return /^-?\d+(?:[.]\d+)?$/.test(value);
        case dataElementTypes.INTEGER:
            return /^-?\d+$/.test(value);
        case dataElementTypes.INTEGER_POSITIVE:
            return /^[1-9]\d*$/.test(value);
        case dataElementTypes.INTEGER_NEGATIVE:
            return /^-\d+$/.test(value);
        case dataElementTypes.INTEGER_ZERO_OR_POSITIVE:
            return /^\d+$/.test(value) || value === '0';
        default:
            return true;
    }
};

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
    saveStatus = 'idle',
}: Props) => {
    const [localValue, setLocalValue] = useState<any>(value ?? null);

    useEffect(() => {
        setLocalValue(value ?? null);
    }, [value, column.id]);

    useEffect(() => {
        if (column.value !== null && column?.rowChanged && column?.rowChanged?.length > 0) {
            onCommit(column?.value, true);
        }
    }, [column.value]);

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

    const handleNumericChange = useCallback((nextValue: string) => {
        if (disabled || !isValidNumericDraft(nextValue, column.type)) {
            return;
        }

        setLocalValue(nextValue);
    }, [column.type, disabled]);

    const handleNumericBlur = useCallback((nextValue: string) => {
        if (disabled) {
            return;
        }

        if (!isValidNumericCommit(nextValue, column.type)) {
            setLocalValue(value ?? '');
            return;
        }

        commit(nextValue);
    }, [column.type, commit, disabled, value]);

    const commonStyle = { minWidth: 180 };
    const statusNode = (saveStatus !== 'idle' || column.required)
        ? (
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 500,
                    marginTop: 6,
                    color: (saveStatus === 'error' || column.required) ? '#ff0000' : saveStatus === 'success' ? '#18c23d' : '#dcc414',
                }}
            >
                {saveStatus === 'saving' ? 'Enviando dados...' : saveStatus === 'success' ? 'Enviado' : column.required ? 'Campo obrigatório*' : 'Campo inválido'}
            </div>
        )
        : null;

    if (column.options && column.type !== dataElementTypes.MULTI_TEXT) {
        return (
            <div style={commonStyle}>
                <SingleSelectField
                    options={optionSetOptions}
                    value={localValue ?? null}
                    onChange={commit}
                    clearable
                    disabled={disabled || column?.disabled}
                />
                {statusNode}
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
                    onSelect={commit}
                    disabled={disabled || column?.disabled}
                />
                {statusNode}
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
                    disabled={disabled || column?.disabled}
                />
                {statusNode}
            </div>
        );
    }

    if (column.type === dataElementTypes.BOOLEAN) {
        return (
            <div>
                <BooleanField
                    value={localValue}
                    onBlur={commit}
                    disabled={disabled || column?.disabled}
                />
                {statusNode}
            </div>
        );
    }

    if (column.type === dataElementTypes.TRUE_ONLY) {
        return (
            <div>
                <TrueOnlyField
                    value={localValue}
                    onBlur={commit}
                    disabled={disabled || column?.disabled}
                />
                {statusNode}
            </div>
        );
    }

    if (NUMBER_TYPES.has(column.type as any)) {
        return (
            <div style={commonStyle}>
                <TextField
                    value={localValue ?? ''}
                    onChange={handleNumericChange}
                    onBlur={handleNumericBlur}
                    disabled={disabled || column?.disabled}
                    inputMode={column.type === dataElementTypes.NUMBER ? 'decimal' : 'numeric'}
                />
                {statusNode}
            </div>
        );
    }

    return (
        <div style={commonStyle}>
            <TextField
                value={localValue ?? ''}
                onChange={setLocalValue}
                onBlur={commit}
                disabled={disabled || column?.disabled}
            />
            {statusNode}
        </div>
    );
});
