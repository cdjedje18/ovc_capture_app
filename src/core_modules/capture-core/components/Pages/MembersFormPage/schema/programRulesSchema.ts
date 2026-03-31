import { atom } from "recoil"
import { ProgramRuleConfig } from "../types/programRules/ProgramRulesTypes"


export const ProgramRulesConfigState = atom<ProgramRuleConfig[]>({
    key: "programRuleConfig-get-state",
    default: []
})