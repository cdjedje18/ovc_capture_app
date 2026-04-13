import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useFormatProgramRules } from '../hooks/useFormatProgramRules';
import { OptionGroupsConfigState } from '../../../schema/optionGroupsSchema';
import { OrgUnitsGroupsConfigState } from '../../../schema/orgUnitsGroupSchema';
import { useFormatProgramRulesVariables } from '../hooks/useFormatProgramRulesVariables';
import { displayTextRule } from '../../../schema/infoSchema';

interface RulesEngineProps {
    variables?: any[];
    values?: Record<string, any>;
    type: 'programStage' | 'programStageSection' | 'attributesSection';
    program: string;
    rowChanged: string;
}

export const CustomDhis2RulesEngine = (props: RulesEngineProps) => {
    const { type, program, rowChanged } = props;
    const getOptionGroups = useRecoilValue(OptionGroupsConfigState);
    const orgUnitsGroups = useRecoilValue(OrgUnitsGroupsConfigState);
    const { programRulesVariables } = useFormatProgramRulesVariables(program);
    const { newProgramRules } = useFormatProgramRules(program);
    const setDisplayTextRule = useSetRecoilState(displayTextRule);

    // ─── Helpers ────────────────────────────────────────────────────────────────

    const isMissing = (value: any) =>
        value === null || value === undefined || value === '' || value === 'undefined';

    function parseValue(value: any): any {
        if (value === undefined || value === null || value === '') return 'undefined';

        const str = String(value).trim();
        const lower = str.toLowerCase();

        if (lower === 'true') return true;
        if (lower === 'false') return false;
        if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);

        return `'${str}'`;
    }

    function createD2(_context: any) {
        const today = new Date().toISOString().split('T')[0];

        return {
            hasValue: (value: any) => !isMissing(value),

            yearsBetween: (date1: any, date2: any) => {
                if (isMissing(date1) || isMissing(date2)) return null;
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                let years = d2.getFullYear() - d1.getFullYear();
                if (
                    d2.getMonth() < d1.getMonth() ||
                    (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate())
                ) years--;
                return years;
            },

            daysBetween: (date1: any, date2: any) => {
                if (isMissing(date1) || isMissing(date2)) return null;
                const d1 = new Date(date1) as unknown as number;
                const d2 = new Date(date2) as unknown as number;
                return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
            },

            monthsBetween: (date1: any, date2: any) => {
                if (isMissing(date1) || isMissing(date2)) return null;
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                let months =
                    (d2.getFullYear() - d1.getFullYear()) * 12 +
                    (d2.getMonth() - d1.getMonth());
                if (d2.getDate() < d1.getDate()) months--;
                return months;
            },

            addDays: (date: any, days: any) => {
                if (isMissing(date) || isMissing(days)) return null;
                const d = new Date(date);
                d.setDate(d.getDate() + parseInt(days));
                return d.toISOString().split('T')[0];
            },

            substring: (text: any, start: any, end: any) => {
                if (isMissing(text)) return '';
                return typeof text === 'string' ? text.substring(parseInt(start), parseInt(end)) : '';
            },

            today: () => today,

            length: (value: any) => {
                if (isMissing(value)) return 0;
                return typeof value === 'string' ? value.length : 0;
            },

            inOrgUnitGroup: (group: any) => {
                if (isMissing(group)) return false;
                return orgUnitsGroups?.some((x: any) => x.value === group) ?? false;
            },

            validatePattern: (value: any, pattern: any) => {
                if (isMissing(value) || isMissing(pattern)) return false;
                try {
                    return new RegExp(pattern).test(value);
                } catch (e) {
                    console.error('Invalid pattern:', pattern, e);
                    return false;
                }
            },

            concatenate: (...args: any[]) =>
                args.map(a => (isMissing(a) ? '' : a)).join(''),

            left: (text: any, num: number) => {
                if (isMissing(text)) return '';
                return typeof text === 'string' ? text.substring(0, num) : '';
            },

            right: (text: any, num: number) => {
                if (isMissing(text)) return '';
                return typeof text === 'string' ? text.substring(text.length - num) : '';
            },

            floor: (value: any) => {
                if (isMissing(value)) return null;
                return Math.floor(value);
            },
        };
    }

    function evaluateExpression(
        expression: any,
        context: any,
        values: any,
        rulesVariables: any
    ): any {
        if (!expression) return null;
        const d2 = createD2(context);

        let expr = expression
            .replace(/\n/g, ' ')
            .replace(/today\(\)/g, 'd2.today()')
            .replace(/d2:(\w+)/g, 'd2.$1')
            .replace(/#\{([^}]+)\}/g, (_: string, key: string) =>
                parseValue(values?.[rulesVariables[key]])
            )
            .replace(/A\{([^}]+)\}/g, (_: string, key: string) =>
                parseValue(values?.[rulesVariables[key]])
            )
            .replace(/V\{([^}]+)\}/g, (_: string, key: string) =>
                parseValue(values?.[key])
            );

        try {
            return new Function('d2', 'context', `return ${expr};`)(d2, context);
        } catch (error) {
            console.error('Error evaluating expression:', expr, error);
            return null;
        }
    }

    // ─── Rules Engine ────────────────────────────────────────────────────────────

    function applyRulesToVariable(variable: any, values: Record<string, any>, idx?: number) {
        const relevantRules = newProgramRules?.filter(
            (x: any) =>
                x.variable === variable.id ||
                x.variable === variable.section ||
                x.programRuleActionType === 'DISPLAYTEXT'
        );

        for (const rule of relevantRules) {
            const conditionMet = evaluateExpression(rule?.condition, variable, values, programRulesVariables);

            switch (rule?.programRuleActionType) {
                case 'DISPLAYTEXT': {
                    setDisplayTextRule(prev => {
                        if (conditionMet && !prev.find(x => x.key === idx)) {
                            return [
                                ...prev,
                                {
                                    key: idx,
                                    name: values?.[sessionStorage.getItem('nomeDoMembro') || ''],
                                    content: rule?.content,
                                },
                            ];
                        } else if (!conditionMet) {
                            return prev?.filter(x => x.key !== idx) || [];
                        }
                        return prev;
                    });
                    break;
                }

                case 'ASSIGN': {
                    if (conditionMet) {
                        const newValue = evaluateExpression(rule.data, variable, values, programRulesVariables);
                        values[variable.id] = newValue ?? '';
                        variable.value = newValue;
                        variable.disabled = true;
                    } else {
                        variable.value = null;
                    }
                    variable.rowChanged = rowChanged;
                    break;
                }

                case 'SHOWOPTIONGROUP': {
                    if (conditionMet) {
                        const options = getOptionGroups?.find((op: any) => op.id === rule?.optionGroup)?.options || [];
                        variable.options = { optionSet: { options } };
                    }
                    break;
                }

                case 'SHOWWARNING': {
                    variable.warning = !!conditionMet;
                    variable.content = conditionMet ? rule?.content : '';
                    break;
                }

                case 'SHOWERROR': {
                    variable.error = !!conditionMet;
                    variable.content = conditionMet ? rule?.content || '' : '';
                    break;
                }

                case 'HIDEFIELD': {
                    variable.disabled = !!conditionMet;
                    break;
                }

                case 'SETMANDATORYFIELD': {
                    variable.required = !!conditionMet;
                    break;
                }

                case 'HIDESECTION': {
                    variable.disabled = !!conditionMet;
                    break;
                }

                case 'HIDEOPTIONGROUP': {
                    const orgUnitMatch = conditionMet?.[0]?.organisationUnits?.some(
                        (x: any) => x.value === values.orgUnit
                    );
                    if (conditionMet && orgUnitMatch) {
                        const groupOptions = getOptionGroups?.find((op: any) => op.id === rule.optionGroup)?.options || [];
                        const initial = variable?.initialOptions?.optionSet?.options || [];
                        variable.options = {
                            optionSet: {
                                options: (variable.optionSet?.options || initial).filter(
                                    (o1: any) => !groupOptions?.some((o2: any) => o2.value === o1.value)
                                ),
                            },
                        };
                    } else if (!conditionMet && variable?.initialOptions?.optionSet?.options) {
                        variable.options = {
                            optionSet: { options: variable?.initialOptions?.optionSet?.options || [] },
                        };
                    }
                    break;
                }
            }
        }

        return variable;
    }

    function mapVariables(variables: any[], values: Record<string, any>, idx?: number) {
        return variables?.map(variable => ({
            ...variable,
            ...(applyRulesToVariable({ ...variable }, values, idx)),
        }));
    }

    // ─── Public ──────────────────────────────────────────────────────────────────

    function runRulesEngine(arg?: {
        overrideVariables?: any[];
        overrideValues?: Record<string, any>;
        idx?: number;
    }) {
        const { overrideVariables = [], overrideValues = {}, idx } = arg || {};

        if (type === 'programStageSection') {
            return overrideVariables?.map(section => ({
                ...section,
                fields: mapVariables(section?.fields, overrideValues, idx),
            }));
        }

        if (type === 'attributesSection') {
            return overrideVariables?.map(section => ({
                ...section,
                variable: mapVariables(section?.variable, overrideValues, idx),
            }));
        }

        if (type === 'programStage') {
            return mapVariables(overrideVariables, overrideValues, idx);
        }
    }

    return { runRulesEngine };
};