import { useSetRecoilState } from 'recoil';
import { useEffect, useState } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
import { OptionGroupsConfig, OptionGroupsConfigState } from '../../schema/optionGroupsSchema';
import { useCacheData } from '../useCacheData/useCacheData';
import useShowAlerts from '../common/useShowAlert';

const OPTION_GROUPS_QUERY = {
    results: {
        resource: 'optionGroups',
        params: {
            fields: 'id,options[code~rename(value),displayName~rename(label)]',
            paging: false,

        },
    },
};

type OptionGroupsQueryResponse = {
    results: {
        optionGroups: OptionGroupsConfig[]
    }
}

export function useGetOptionGroups(): any {
    const { hide, show } = useShowAlerts();
    const { getDataFromDB, saveDataToDB } = useCacheData();
    const [error, setError] = useState<boolean>(false);
    const setOptionGroupsConfigState = useSetRecoilState(OptionGroupsConfigState);

    const { data, loading: loadingOptionGroups, refetch } = useDataQuery<OptionGroupsQueryResponse>(OPTION_GROUPS_QUERY, {
        onError(error: { message: string }) {
            show({
                message: `${('Could not get option groups')}: ${error.message}`,
                type: { critical: true },
            });
            setTimeout(hide, 5000);
            setError(true);
        },
        onComplete(response: { results: { optionGroups: any[] } }) {
            setOptionGroupsConfigState(response?.results?.optionGroups);
            // Salva no cache com uma chave fixa para o conjunto
            saveDataToDB({ id: 'optionGroups', data: response?.results?.optionGroups }, 'optionGroups');
        },
        lazy: true,
    });

    useEffect(() => {
        (async () => {
            const cached = await getDataFromDB('optionGroups', 'optionGroups');
            if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
                setOptionGroupsConfigState(cached.data);
            } else {
                void refetch();
            }
        })();
    }, []);

    return { loadingOptionGroups, refetch, errorOptionGroups: error };
}
