import isEqual from "isEqual";
import { useRecoilValue } from "recoil";
import { useState, useEffect } from "react";
import { useFormatProgramRules } from "../hooks/useFormatProgramRules";
import { OptionGroupsConfigState } from "../../../schema/optionGroupsSchema";
import { OrgUnitsGroupsConfigState } from "../../../schema/orgUnitsGroupSchema";
import { useFormatProgramRulesVariables } from "../hooks/useFormatProgramRulesVariables";

interface RulesEngineProps {
    variables?: any[]
    values?: Record<string, any>
    type: "programStage" | "programStageSection" | "attributesSection"
    program: string,
    rowChanged: string,
}

export const CustomDhis2RulesEngine = (props: RulesEngineProps) => {
    const { type, program, rowChanged } = props;
    const getOptionGroups = useRecoilValue(OptionGroupsConfigState);
    const orgUnitsGroups = useRecoilValue(OrgUnitsGroupsConfigState);
    const { programRulesVariables } = useFormatProgramRulesVariables(program);
    const { newProgramRules } = useFormatProgramRules(program);

    // const [currentValues, setCurrentValues] = useState({ ...props.values });
    // const [updatedVariables, setUpdatedVariables] = useState<any[]>(Array.isArray(props.variables) ? [...props.variables] : []);

    // useEffect(() => {
    //     if (!isEqual(updatedVariables, props.variables)) {
    //         setUpdatedVariables([...props.variables]);
    //     }
    // }, [props.variables]);

    function runRulesEngine(arg?: { overrideVariables?: any[], overrideValues?: Record<string, any> }) {
        const { overrideVariables = [], overrideValues = {} } = arg || {};
        const variablesToUse = overrideVariables
        const valuesToUse = overrideValues

        // console.log(valuesToUse, variablesToUse, 'yuiiiii')
        // if (!isEqual(currentValues, valuesToUse)) {
        //     setCurrentValues({ ...valuesToUse });
        // }
        // if (!isEqual(updatedVariables, variablesToUse)) {
        //     setUpdatedVariables([...variablesToUse]);
        // }

        if (type === "programStageSection") return rulesEngineSections(variablesToUse, valuesToUse);
        else if (type === "programStage") return rulesEngineDataElements(variablesToUse, valuesToUse);
        else if (type === "attributesSection") return rulesEngineAttributesSections(variablesToUse, valuesToUse);
    }

    function rulesEngineAttributesSections(variables: any[], values: Record<string, any>) {
        const updated = variables.map(section => ({
            ...section,
            variable: section.variable.map((variable: any) => {
                const copy = { ...variable };
                return applyRulesToVariable(copy, values);
            })
        }));
        // setUpdatedVariables(updated);
    }

    function rulesEngineSections(variables: any[], values: Record<string, any>) {
        const updated = variables.map(section => ({
            ...section,
            fields: section.fields.map((variable: any) => {
                const copy = { ...variable };
                return applyRulesToVariable(copy, values);
            })
        }));
        return updated
        // setUpdatedVariables(updated);
    }

    function rulesEngineDataElements(variables: any[], values: Record<string, any>) {
        const updated = variables.map(variable => {
            const copy = { ...variable };
            return applyRulesToVariable(copy, values);
        });
        return updated

        // setUpdatedVariables(updated);
    }


    function parseValue(value: any) {
        if (value === undefined || value === null || value === "") {
            return "undefined";
        }

        const lower = value.toLowerCase();

        if (lower === "true") return true;
        if (lower === "false") return false;

        if (!isNaN(value) && value.trim() !== "") {
            return Number(value);
        }

        return `'${value}'`;
    }


    function evaluateExpression(expression: any, context: any, values: any, programRulesVariables: any) {
        const d2 = createD2(context);

        expression = expression.replace(/today\(\)/g, `d2.today()`);
        expression = expression.replace(/d2:(\w+)/g, "d2.$1");
        expression = expression.replace(/V\{event_date\}/g, "V{enrollment_date}");

        expression = expression.replace(/#\{([^}]+)\}/g, (_: string, key: string) => {
            const value = values[programRulesVariables[key]];
            return parseValue(value);
        });

        expression = expression.replace(/A\{([^}]+)\}/g, (_: string, key: any) => {
            const value = values[programRulesVariables[key]];
            return parseValue(value);
        });

        expression = expression.replace(/V\{([^}]+)\}/g, (_: string, key: any) => {
            const value = values[key];
            return parseValue(value);
        });

        try {
            const func = new Function('d2', 'context', `return ${expression};`);
            return func(d2, context);
        } catch (error) {
            console.error('Error evaluating expression:', expression, error);
            return null;
        }
    }

    function createD2(context: any) {
        const today = new Date().toISOString().split('T')[0];

        return {
            hasValue: (value: any) => value !== null && value !== undefined && value !== '',
            yearsBetween: (date1: any, date2: any) => {
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                let years = d2.getFullYear() - d1.getFullYear();
                if (d2.getMonth() < d1.getMonth() || (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate())) {
                    years--;
                }
                return years;
            },
            daysBetween: (date1: any, date2: any) => {
                const d1 = new Date(date1) as unknown as number;
                const d2 = new Date(date2) as unknown as number;
                return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
            },
            addDays: (date: any, days: any) => {
                const d = new Date(date);
                d.setDate(d.getDate() + parseInt(days));
                return d.toISOString().split('T')[0];
            },
            substring: (text: any, start: any, end: any) => typeof text === 'string' ? text.substring(parseInt(start), parseInt(end)) : '',
            today: () => today,
            length: (value: any) => typeof value === 'string' ? value.length : 0,
            inOrgUnitGroup: (group: any) => orgUnitsGroups?.filter(x => x.value === group),
            validatePattern: (value: any, pattern: any) => {
                try {
                    return new RegExp(pattern).test(value);
                } catch (error) {
                    console.error('Invalid pattern:', pattern, error);
                    return false;
                }
            },
            concatenate: (...args: any) => args.join(""),
            left: (text: any, num: number) => typeof text === "string" ? text.substring(0, num) : "",
            right: (text: any, num: number) => typeof text === "string" ? text.substring(text.length - num) : "",
            floor: (value: number) => Math.floor(value),
        };
    }

    function applyRulesToVariable(variable: any, values: Record<string, any>) {
        for (const rule of newProgramRules.filter(x => x.variable === variable.id)) {
            const conditionResult = evaluateExpression(rule.condition, variable, values, programRulesVariables);

            switch (rule.programRuleActionType) {
                case "ASSIGN":
                    if (conditionResult) {
                        const newValue = evaluateExpression(rule.data, variable, values, programRulesVariables);
                        values[variable.id] = newValue ?? "";
                        variable["value"] = newValue
                    } else variable["value"] = null
                    variable.disabled = true;
                    variable.rowChanged = rowChanged
                    break;

                case "SHOWOPTIONGROUP":
                    if (conditionResult) {
                        const options = getOptionGroups?.find(op => op.id === rule.optionGroup)?.options || [];
                        variable.options = { optionSet: { options } };
                    }
                    break;

                case "SHOWWARNING":
                    variable.warning = !!conditionResult;
                    variable.content = conditionResult ? rule.content : "";
                    break;

                case "SHOWERROR":
                    variable.error = !!conditionResult;
                    // variable.required = !!conditionResult;
                    variable.content = conditionResult ? rule.content : "";
                    break;

                case "HIDEFIELD":
                    variable.disabled = !!conditionResult;
                    break;

                case "HIDEOPTIONGROUP":
                    if (conditionResult && conditionResult[0]?.organisationUnits?.some((x: any) => x.value === values["orgUnit"])) {
                        const groupOptions = getOptionGroups?.find(op => op.id === rule.optionGroup)?.options || [];
                        const initial = variable.initialOptions?.optionSet?.options || [];
                        variable.options = {
                            optionSet: {
                                options: (variable.optionSet?.options || initial).filter(
                                    (o1: any) => !groupOptions.some((o2: any) => o2.value === o1.value)
                                )
                            }
                        };

                    } else if (!conditionResult && variable.initialOptions?.optionSet?.options) {
                        variable.options = { optionSet: { options: variable.initialOptions?.optionSet?.options || [] } };
                    }
                    break;
            }
        }
        return variable;
    }

    return {
        runRulesEngine,
        // updatedVariables
    };
};
