import { useRecoilValue } from 'recoil';
import { ProgramRulesConfigState } from '../../../schema/programRulesSchema';
import { formatProgramRules } from '../programRulesUtils/formatProgramRules';

export function useFormatProgramRules(program: string) {
    const programRulesConfigState = useRecoilValue(ProgramRulesConfigState);

    return {
        newProgramRules: formatProgramRules(programRulesConfigState).filter(pRule => pRule.program === program),
    };
}
