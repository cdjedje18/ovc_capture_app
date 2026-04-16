import { useDataQuery } from '@dhis2/app-runtime';
import useShowAlerts from '../common/useShowAlert';
import { getLocationQuery } from 'capture-core/utils/routing';
import { useSetRecoilState } from 'recoil';
import { orgUnitSchema } from '../../schema/optionGroupsSchema';

const OPTION_GROUPS_QUERY: any = {
    results: {
        resource: 'organisationUnits',
        id: ({ id }) => id
        // params: {
        //     fields: 'id,options[code~rename(value),displayName~rename(label)]',
        //     paging: false,

        // },
    },
};

export function useGetOrgUnit(): any {
    const { hide, show } = useShowAlerts();
    const { orgUnitId }: { orgUnitId: string } = getLocationQuery();
    const setOrgUnit = useSetRecoilState(orgUnitSchema)

    const { data, loading: loadingOptionGroups, error } = useDataQuery<any>(OPTION_GROUPS_QUERY, {
        onError(error: { message: string }) {
            show({
                message: `${('Could not get option groups')}: ${error.message}`,
                type: { critical: true },
            });
            setTimeout(hide, 5000);
        },
        onComplete(response: any) {
            setOrgUnit({
                id: response?.results?.id,
                "name": response?.results?.name,
                "code": response?.results?.code,
                "path": response?.results?.path,
                "groups": []
            })
        },
        variables: { id: orgUnitId },
    });

    return { loadingOptionGroups, error };
}
