import { useRecoilValue } from 'recoil';
import { ProgramRulesConfigState } from '../../../schema/programRulesSchema';
import { formatProgramRules } from '../programRulesUtils/formatProgramRules';

export function useFormatProgramRules(program: string) {
    const programRulesConfigState = useRecoilValue(ProgramRulesConfigState);
    const rules = formatProgramRules(programRulesConfigState).filter(pRule => pRule.program === program)

    return {
        newProgramRules: rules?.filter(x => x.programStage == sessionStorage.getItem('dataEntryStage')),
    };
}
