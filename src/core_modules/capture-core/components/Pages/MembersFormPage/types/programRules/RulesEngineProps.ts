import { CustomAttributeProps, GroupFormProps } from 'dhis2-semis-types';

/** A group of valid program rules types to specify the implementation. */
export enum RulesType {
    ProgramStage = 'ProgramStage',
    AttributesSection = 'AttributesSection',
    ProgramStageSection = 'ProgramStageSection',
}

/**
 * Rules Engine Interface.
 * @interface RulesEngineProps
 * @typedef {RulesEngineProps}
 */
interface RulesEngineProps {
    /**
     * Defines the sent variables structure, i.e.
     * if the sent variables are a ProgramStageSection, AttributeSection an array of Data Elements.
     * @type {RulesType}
     */
    type: RulesType
    /**
     * The program stage from where the variables come. Optional.
     * @type {?string}
     */
    programStage?: string
    /**
     * The values entered into fields or components where the Rules Engine is being called.
     * @type {Record<string, any>}
     */
    values: Record<string, any>
    /**
     * The variables to which the Program Rules should be apllied.
     * @type {(GroupFormProps[] | CustomAttributeProps[])}
     */
    variables: GroupFormProps[] | CustomAttributeProps[]
    /**
     * A method to run when an error occurs.
     * @type {void}
     */
    onError: (message: string) => void
}

/**
 * Rules Engine Wrapper Interface.
 * @interface RulesEngineWrapperProps
 * @typedef {RulesEngineWrapperProps}
 */
interface RulesEngineWrapperProps {
    /**
     * The programs to fetch program rules for.
     * @type {string[]}
     */
    programs: string[],
    /**
     * The application body or other high level wrappers under Rules Engine.
     * @type {React.ReactNode}
     */
    children: React.ReactNode,
}

export type { RulesEngineProps, RulesEngineWrapperProps };
