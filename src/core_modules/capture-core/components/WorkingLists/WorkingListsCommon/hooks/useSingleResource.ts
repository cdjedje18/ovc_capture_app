import { useMemo } from 'react';
import { useDataEngine } from '@dhis2/app-runtime';
import { makeQuerySingleResource } from 'capture-core/utils/api';

export const  CustomQuerySingleResource= () => {
    const dataEngine = useDataEngine();
    
    const querySingleResource = useMemo(() => 
        makeQuerySingleResource(dataEngine.query.bind(dataEngine)), 
    [dataEngine]);

    return { querySingleResource };
};