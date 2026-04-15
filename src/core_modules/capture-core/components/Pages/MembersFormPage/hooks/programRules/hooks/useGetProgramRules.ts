import { useSetRecoilState } from 'recoil';
import { useEffect, useState } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
import useShowAlerts from '../../common/useShowAlert';
import { ProgramRulesConfigState } from '../../../schema/programRulesSchema';
import { ProgramRuleConfig } from '../../../types/programRules/ProgramRulesTypes';
import { useCacheData } from '../../../hooks/useCacheData/useCacheData';

const PROGRAM_RULES_QUERY = {
    results: {
        resource: 'programRules',
        params: ({ programFilter }: any) => ({
            paging: false,
            filter: programFilter,
            fields: 'id,displayName,condition,description,program[id],programStage[id],priority,programRuleActions[id,content,location,data,programRuleActionType,programStageSection[id],dataElement[id],trackedEntityAttribute[id],option[id],optionGroup[id],programIndicator[id],programStage[id]]',

        }),
    },
};

type ProgramRulesQueryResponse = {
    results: {
        programRules: ProgramRuleConfig[]
    }
}

export function useGetProgramRules(programs: string[]): any {
    const { hide, show } = useShowAlerts();
    const { getDataFromDB, saveDataToDB } = useCacheData();
    const [error, setError] = useState<boolean>(false);
    const setProgramRulesConfigState = useSetRecoilState(ProgramRulesConfigState);

    const { data, loading: loadingPRules, refetch } = useDataQuery<ProgramRulesQueryResponse>(PROGRAM_RULES_QUERY, {
        variables: {
            programFilter: `program.id:in:[${programs.join(',')}]`,
        },
        onError(error: { message: string }) {
            show({
                message: `${('Could not get program rules')}: ${error?.message}`,
                type: { critical: true },
            });
            setTimeout(hide, 5000);
            setError(true);
        },
        onComplete(response: { results: { programRules: any[] } }) {
            setProgramRulesConfigState(response?.results?.programRules);
            saveDataToDB({ id: 'programRules', data: response?.results?.programRules }, 'programRules');
        },
        lazy: true,
    });

    useEffect(() => {
        (async () => {
            const cached = await getDataFromDB('programRules', 'programRules');
            if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
                setProgramRulesConfigState(cached.data);
            } else {
                void refetch();
            }
        })();
    }, []);

    return { loadingPRules, refetch, errorPRules: error };
}
