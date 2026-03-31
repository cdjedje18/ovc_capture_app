interface ProgramRuleConfig {
    id: string
    condition: string
    displayName: string
    description: string
    program: {
        id: string
    }
    programRuleActions: ProgramRuleAction[]
    content?: string
    programStage?: {
        id: string
    }
}

interface ProgramRuleAction {
    id: string
    programRuleActionType: string
    trackedEntityAttribute?: {
        id: string
    }
    dataElement?: {
        id: string
    }
    optionGroup?: {
        id: string
    }
    programStageSection?: {
        id: string
    }
    data?: string
    displayName?: string
    content?: string
}

interface ProgramRuleVariableConfig {
    name: string
    program: {
        id: string
    }
    trackedEntityAttribute?: {
        id: string
    }
    dataElement?: {
        id: string
    }
}

export type { ProgramRuleConfig, ProgramRuleAction, ProgramRuleVariableConfig }