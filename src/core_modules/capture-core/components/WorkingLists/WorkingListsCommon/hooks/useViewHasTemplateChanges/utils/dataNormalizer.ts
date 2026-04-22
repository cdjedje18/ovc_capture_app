import moment from "moment";

type ColumnMeta = {
    id: string;
    type: string;
    options?: { value: string }[];
};

const formatDate = (value: any) => {
    const m = moment(value, ["YYYY-MM-DD", "DD-MM-YYYY", moment.ISO_8601], true);
    return m.isValid() ? m.format("YYYY-MM-DD") : null;
};

const toBoolean = (value: any) => {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
};

const toNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const isValidOption = (value: any, options?: ColumnMeta["options"]) => {
    if (!options?.length) return true;
    return options.some(o => o.value === value);
};

const formatValue = (value: any, type: string) => {
    switch (type) {
        case "DATE":
            return formatDate(value);

        case "BOOLEAN":
            return toBoolean(value);

        case "INTEGER":
        case "INTEGER_POSITIVE":
        case "INTEGER_ZERO_OR_POSITIVE":
        case "NUMBER":
            return toNumber(value);

        case "TRUE_ONLY":
            return value === true || value === "true" ? true : null;

        default:
            return value;
    }
};

export const buildValidatedDataValues = (
    restRowValues: Record<string, any>,
    columns: ColumnMeta[]
) => {
    const columnMap = new Map(columns.map(c => [c.id, c]));

    return Object.entries(restRowValues)
        .map(([dataElement, rawValue]) => {
            const col = columnMap.get(dataElement);

            if (!col) return null;

            const formatted = formatValue(rawValue, col.type);

            // remove empty values early
            if (formatted === null || formatted === undefined || formatted === "") {
                return {
                    dataElement,
                    value: formatted,
                }
            }

            // TRUE_ONLY rule (DHIS2 strict)
            if (col.type === "TRUE_ONLY") {
                if (formatted !== true) return null;
            }

            // OPTION SET validation
            if (!isValidOption(formatted, col.options)) {
                return null;
            }

            return {
                dataElement,
                value: formatted,
            };
        })
        .filter(Boolean) as { dataElement: string; value: any }[];
};