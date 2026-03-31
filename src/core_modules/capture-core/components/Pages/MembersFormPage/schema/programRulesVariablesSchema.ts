import { atom } from "recoil"
import { ProgramRuleVariableConfig } from "../types/programRules/ProgramRulesTypes"

export const ProgramRulesVariablesConfigState = atom<ProgramRuleVariableConfig[]>({
    key: "programRuleVariableConfig-get-state",
    default: []
})
