import { useMemo } from 'react';
import type { CustomColumnOrder } from '..';
import { isMembersFormPage } from '../../utils/isMembersFormPage';

export const useColumns = <TColumnConfigs extends Array<{ id: string, visible: boolean, [key: string]: any }>>(
    customColumnOrder: CustomColumnOrder | undefined,
    defaultColumns: TColumnConfigs,
    elementsWithSections: any[],
): TColumnConfigs => {
    const arr1Map = new Map(elementsWithSections.map(item => [item.id, item]))
    const result = defaultColumns.map(item => {
        const match = arr1Map.get(item.id);

        if (match) {
            return {
                ...item,
                section: match.section
            };
        }

        return item;
    });

    const defaultColumnsAsObject = useMemo(() =>
        result
            .reduce((acc, column) => ({ ...acc, [column.id]: column }), {} as Record<string, any>),
        [defaultColumns]);

    return useMemo(() => {
        if (!customColumnOrder) {
            return (isMembersFormPage() ? [
                ...result.filter(col => col.id !== 'actions'),
                ...result.filter(col => col.id === 'actions'),
            ] : result) as any;
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
