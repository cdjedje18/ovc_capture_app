import { useRecoilValue } from "recoil";
import { ProgramRulesVariablesConfigState } from "../../../schema/programRulesVariablesSchema";
import { formatProgramRuleVariables } from "../programRulesUtils/formatProgramRules";

export function useFormatProgramRulesVariables(program: string) {
    const programRulesVariablesConfigState = useRecoilValue(ProgramRulesVariablesConfigState);

    return {
        programRulesVariables: formatProgramRuleVariables(programRulesVariablesConfigState, program),
    }
}