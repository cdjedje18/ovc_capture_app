import { useGetProgramRules } from '../hooks/useGetProgramRules';
import { useGetOptionGroups } from '../../optionGroup/useGetOptionGroups';
import { useOrgUnitsGroups } from '../../orgUnitsGroup/useOrgUnitsGroups';
import { useGetProgramRulesVariables } from '../hooks/useGetProgramRulesVariables';

/**
 * A function to fetch the required variables to run program rules.
 * @param {string[]} programs - An array of strings whith the required program ids.
 * @returns {{loading: boolean; error: boolean; }}
 */
export default function FetchEngineVariables(programs: string[]) {
    const { loadingPRules, errorPRules } = useGetProgramRules(programs);
    const { loadingOptionGroups, errorOptionGroups } = useGetOptionGroups();
    const { loadingOrgUnitsGroups, errorOrgUnitsGroups } = useOrgUnitsGroups();
    const { loadingPRulesVariables, errorPRulesVariables } = useGetProgramRulesVariables(programs);

    return {
        error: errorPRules || errorOptionGroups || errorOrgUnitsGroups || errorPRulesVariables,
        loading: loadingPRules || loadingPRulesVariables || loadingOptionGroups || loadingOrgUnitsGroups,
    }

}