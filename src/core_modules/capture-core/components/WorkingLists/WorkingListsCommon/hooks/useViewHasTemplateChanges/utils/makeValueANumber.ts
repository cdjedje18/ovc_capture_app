const numberTypes = ["NUMBER", "INTEGER", "INTEGER_ZERO_OR_POSITIVE", "INTEGER_POSITIVE", "INTEGER_NEGATIVE"];

export function makeNumbers(fields, valuesObj) {
    return Object.fromEntries(
        Object.entries(valuesObj).map(([key, value]) => {
            const field = fields.find(f => f.id === key);
            const isNumeric = field && numberTypes.includes(field.type);
            return [key, isNumeric ? Number(value) : value];
        })
    );
}