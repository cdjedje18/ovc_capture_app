import { useSetRecoilState } from 'recoil';
import { useEffect, useState } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
import { OrgUnitsGroupsConfig, OrgUnitsGroupsConfigState } from '../../schema/orgUnitsGroupSchema';
import { useCacheData } from '../useCacheData/useCacheData';
import useShowAlerts from '../common/useShowAlert';

const OPTION_GROUPS_QUERY = {
    results: {
        resource: 'organisationUnitGroups',
        params: {
            fields: 'code~rename(value),displayName~rename(label),organisationUnits[id~rename(value),displayName~rename(label)]',
            paging: false,

        },
    },
};

type OrgUnitGroupsQueryResponse = {
    results: {
        organisationUnitGroups: OrgUnitsGroupsConfig[]
    }
}

export function useOrgUnitsGroups():any {
    const { hide, show } = useShowAlerts();
    const [error, setError] = useState<boolean>(false);
    const setOrgUnitsGroupsConfigState = useSetRecoilState(OrgUnitsGroupsConfigState);
    const { getDataFromDB, saveDataToDB } = useCacheData();

    const { data, loading: loadingOrgUnitsGroups, refetch } = useDataQuery<OrgUnitGroupsQueryResponse>(OPTION_GROUPS_QUERY, {
        onError(error: { message: string }) {
            show({
                message: `${('Could not get organisation units groups')}: ${error.message}`,
                type: { critical: true },
            });
            setTimeout(hide, 5000);
            setError(true);
        },
        onComplete(response: { results: { organisationUnitGroups: any[] } }) {
            setOrgUnitsGroupsConfigState(response?.results?.organisationUnitGroups);
            saveDataToDB({ id: 'organisationUnitGroups', data: response?.results?.organisationUnitGroups }, 'organisationUnitGroups');
        },
        lazy: true,
    });

    useEffect(() => {
        (async () => {
            const cached = await getDataFromDB('organisationUnitGroups', 'organisationUnitGroups');
            if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
                setOrgUnitsGroupsConfigState(cached.data);
            } else {
                void refetch();
            }
        })();
    }, []);

    return { loadingOrgUnitsGroups, refetch, errorOrgUnitsGroups: error };
}
