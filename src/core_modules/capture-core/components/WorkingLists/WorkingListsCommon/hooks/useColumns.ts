import { useMemo } from 'react';
import type { CustomColumnOrder } from '..';
import { isMembersFormPage } from '../../utils/isMembersFormPage';

export const useColumns = <TColumnConfigs extends Array<{ id: string, visible: boolean, [key: string]: any }>>(
    customColumnOrder: CustomColumnOrder | undefined,
    defaultColumns: TColumnConfigs,
): TColumnConfigs => {
    const defaultColumnsAsObject = useMemo(() =>
        defaultColumns
            .reduce((acc, column) => ({ ...acc, [column.id]: column }), {} as Record<string, any>),
        [defaultColumns]);

    return useMemo(() => {
        if (!customColumnOrder) {
            return (isMembersFormPage() ? [
                ...defaultColumns.filter(col => col.id !== 'actions'),
                ...defaultColumns.filter(col => col.id === 'actions'),
            ] : defaultColumns) as any;
        }

        const columnsFromCustomOrder = customColumnOrder.reduce((acc: any[], { id, visible }) => {
            if (defaultColumnsAsObject[id]) {
                return [
                    ...acc,
                    {
                        ...defaultColumnsAsObject[id],
                        visible,
                    },
                ];
            }
            return acc;
        }, []);

        const customOrderIds = new Set(columnsFromCustomOrder.map(column => column.id));
        const columnsMissingFromCustomOrder = defaultColumns.filter(column => !customOrderIds.has(column.id));

        const cols = [...columnsFromCustomOrder, ...columnsMissingFromCustomOrder]

        return (isMembersFormPage() ? [
            ...cols.filter(col => col.id !== 'actions'),
            ...cols.filter(col => col.id === 'actions'),
        ] : cols) as TColumnConfigs;
    }, [customColumnOrder, defaultColumns, defaultColumnsAsObject]);
};
