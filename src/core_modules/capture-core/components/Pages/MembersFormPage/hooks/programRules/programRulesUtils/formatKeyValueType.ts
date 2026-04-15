export function formatKeyValueType(variables: any): Record<string, string> {
    const keys: Record<string, any> = {};

    if (Object.keys(variables[0]).includes('fields')) {
        for (const iterator of variables) {
            if (iterator?.fields) {
                for (const variable of iterator?.fields) {
                    keys[variable.name] = variable.valueType;
                }
            }
        }
    } else {
        for (const variable of variables) {
            keys[variable.id] = variable.valueType;
        }
    }


    return keys;
}
