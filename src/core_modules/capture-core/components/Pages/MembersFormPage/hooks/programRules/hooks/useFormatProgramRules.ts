import { useRecoilValue } from 'recoil';
import { ProgramRulesConfigState } from '../../../schema/programRulesSchema';
import { formatProgramRules } from '../programRulesUtils/formatProgramRules';

export function useFormatProgramRules(program: string) {
    const programRulesConfigState = useRecoilValue(ProgramRulesConfigState);
    const rules = formatProgramRules(programRulesConfigState).filter(pRule => pRule.program === program)
    const dataEntryStage = localStorage.getItem('dataEntryStage');

    const newProgramRules = rules?.filter(x => x.programStage === dataEntryStage || !x?.programStage);

    console.log(newProgramRules,'as regrinhas')
    return {
        newProgramRules: newProgramRules,
    };
}
