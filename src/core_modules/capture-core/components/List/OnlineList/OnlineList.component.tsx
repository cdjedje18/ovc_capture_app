import * as React from 'react';
import i18n from '@dhis2/d2-i18n';
import {
    CheckboxField,
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
} from '@dhis2/ui';
import { cx } from '@emotion/css';
import { withStyles, type WithStyles } from 'capture-core-utils/styles';
import type { ReactNode } from 'react';
import type { OptionSet } from '../../../metaData';
import { dataElementTypes } from '../../../metaData';
import { withRouter, RouteComponentProps } from "react-router-dom";
import { buildUrlQueryString } from 'capture-core/utils/routing';
import { withApiUtils } from '../../../HOC';

const getStyles: Readonly<any> = {
    tableContainer: {
        overflowX: 'auto',
    },
    loadingRow: {
        height: 100,
    },
    headerAlign: {
        '&>span.container': {
            alignItems: 'flex-end',
        },
    },
};

export type Column = {
    id: string;
    header: string;
    visible: boolean;
    type: keyof typeof dataElementTypes;
    optionSet?: OptionSet | null;
    sortDisabled?: boolean;
};

type Props = {
    dataSource: Array<any>;
    rowIdKey: string;
    columns: Array<Column> | null;
    selectedRows: { [key: string]: boolean };
    onSelectAll: (ids: Array<string>) => void;
    onRowSelect: (id: string) => void;
    allRowsAreSelected: boolean;
    isSelectionInProgress: boolean;
    sortById: string;
    showSelectCheckBox: boolean | null;
    sortByDirection: string;
    onSort: (id: string, direction: string) => void;
    updating?: boolean;
    getCustomEndCellHeader?: (props: Props) => ReactNode;
    onRowClick: (rowData: any) => void;
    getCustomEndCellBody?: (row: any, props: Props) => ReactNode;
    customEndCellHeaderStyle?: any;
    customEndCellBodyStyle?: any;
    querySingleResource: (query: { resource: string; params?: Record<string, any> }) => Promise<any>;
} & WithStyles<typeof getStyles>;

const MEMBERS_FORM_PATH = '/membersForm';

class Index extends React.Component<Props & RouteComponentProps> {
    static membersEntryProgramId?: string;
    static membersEntryProgramIdPromise?: Promise<string | undefined>;
    static relationshipTypeByProgramId?: Record<string, string>;
    static relationshipTypeByProgramIdPromise?: Promise<Record<string, string>>;

    componentDidMount() {
        if (!this.isMembersFormPage()) {
            void Promise.all([
                this.getMembersEntryProgramId(),
                this.getRelationshipTypeByProgramId(),
            ]);
        }
    }

    isMembersFormPage = () => this.props.location.pathname.includes(MEMBERS_FORM_PATH);

    getMembersEntryProgramId = async (): Promise<string | undefined> => {
        if (Index.membersEntryProgramId) {
            return Index.membersEntryProgramId;
        }

        if (Index.membersEntryProgramIdPromise) {
            return Index.membersEntryProgramIdPromise;
        }

        Index.membersEntryProgramIdPromise = this.props.querySingleResource({
            resource: 'dataStore/ovc_capture_app/data_entry',
        }).then((dataEntryResponse) => {
            const programs = Array.isArray(dataEntryResponse?.programs) ? dataEntryResponse.programs : [];
            const membersEntryProgramId = programs.find((entry: any) => typeof entry?.program === 'string' && entry.program)?.program;

            Index.membersEntryProgramId = membersEntryProgramId;
            return membersEntryProgramId;
        }).finally(() => {
            Index.membersEntryProgramIdPromise = undefined;
        });

        return Index.membersEntryProgramIdPromise;
    };

    getRelationshipTypeByProgramId = async (): Promise<Record<string, string>> => {
        if (Index.relationshipTypeByProgramId) {
            return Index.relationshipTypeByProgramId;
        }

        if (Index.relationshipTypeByProgramIdPromise) {
            return Index.relationshipTypeByProgramIdPromise;
        }

        Index.relationshipTypeByProgramIdPromise = this.props.querySingleResource({
            resource: 'dataStore/ovc_capture_app/programs',
        }).then((programsResponse) => {
            const masterPrograms = Array.isArray(programsResponse?.masterPrograms) ? programsResponse.masterPrograms : [];
            const relationshipTypeByProgramId = masterPrograms.reduce((acc: Record<string, string>, entry: any) => {
                if (typeof entry?.id === 'string' && typeof entry?.relationshipType === 'string') {
                    acc[entry.id] = entry.relationshipType;
                }

                return acc;
            }, {});

            Index.relationshipTypeByProgramId = relationshipTypeByProgramId;
            return relationshipTypeByProgramId;
        }).finally(() => {
            Index.relationshipTypeByProgramIdPromise = undefined;
        });

        return Index.relationshipTypeByProgramIdPromise;
    };

    myOnClickListRow = async (row: any) => {
        const query = this.props.location.search;
        const params = Object.fromEntries(new URLSearchParams(query));
        const currentProgramId = typeof params.programId === 'string' ? params.programId : undefined;

        let membersEntryProgramId: string | undefined;
        let relationshipTypeByProgramId: Record<string, string> = {};
        try {
            [membersEntryProgramId, relationshipTypeByProgramId] = await Promise.all([
                this.getMembersEntryProgramId(),
                this.getRelationshipTypeByProgramId(),
            ]);
        } catch {
            membersEntryProgramId = undefined;
            relationshipTypeByProgramId = {};
        }

        this.props.history.push(`${MEMBERS_FORM_PATH}?${buildUrlQueryString({
            ...params,
            masterTEI: row.id,
            ...(currentProgramId && relationshipTypeByProgramId[currentProgramId]
                ? { relationshipType: relationshipTypeByProgramId[currentProgramId] }
                : {}),
            ...(membersEntryProgramId ? { entryProgram: membersEntryProgramId } : {}),
        })}`);
    }

    getSortHandler =
        (id: string) =>
            ({ direction }: { direction: string }) => {
                this.props.onSort(id, direction);
            };

    getCustomEndCellHeader = () => {
        const { getCustomEndCellHeader, getCustomEndCellBody } = this.props;

        return getCustomEndCellBody ? (
            <DataTableColumnHeader>
                {getCustomEndCellHeader && getCustomEndCellHeader(this.props)}
            </DataTableColumnHeader>
        ) : null;
    };

    getCustomEndCellBody = (row: any, customEndCellBodyProps: any) => {
        const { getCustomEndCellBody } = this.props;

        return getCustomEndCellBody ? (
            <DataTableCell>
                {getCustomEndCellBody(row, customEndCellBodyProps)}
            </DataTableCell>
        ) : null;
    };

    static typesWithRightPlacement = [
        dataElementTypes.NUMBER,
        dataElementTypes.INTEGER,
        dataElementTypes.INTEGER_POSITIVE,
        dataElementTypes.INTEGER_NEGATIVE,
        dataElementTypes.INTEGER_ZERO_OR_POSITIVE,
    ];

    renderHeaderRow(visibleColumns: Column[]) {
        const { classes, sortById, sortByDirection, dataSource, onSelectAll, allRowsAreSelected } = this.props;

        const getSortDirection = (column: Column): 'asc' | 'desc' | 'default' | undefined => {
            if (column.sortDisabled) {
                return undefined;
            }
            return sortById === column.id ? (sortByDirection as 'asc' | 'desc') : 'default';
        };

        const headerCells = visibleColumns.map((column: any) => (
            <DataTableColumnHeader
                dataTest={`table-row-${sortById === column.id ? sortByDirection : 'default'}`}
                onSortIconClick={this.getSortHandler(column.id)}
                sortDirection={getSortDirection(column)}
                key={column.id}
                align={Index.typesWithRightPlacement.includes(column.type) ? 'right' : 'left'}
                className={cx({ [classes.headerAlign]: Index.typesWithRightPlacement.includes(column.type) })}
            >
                {column.header}
            </DataTableColumnHeader>
        ));

        const checkboxCell = this.props.showSelectCheckBox ? (
            <DataTableColumnHeader
                dataTest={'select-all-rows-checkbox'}
            >
                <CheckboxField
                    checked={allRowsAreSelected}
                    onChange={() => onSelectAll(dataSource.map((item: any) => item.id))}
                />
            </DataTableColumnHeader>
        ) : null;

        return (
            <DataTableRow dataTest="table-row">
                {checkboxCell}
                {headerCells}
                {this.getCustomEndCellHeader()}
            </DataTableRow>
        );
    }

    renderBody(visibleColumns: Column[]) {
        const { updating, classes } = this.props;
        const columnsCount = visibleColumns.length + (this.props.getCustomEndCellBody ? 1 : 0);

        return updating ? (
            <DataTableRow className={classes.loadingRow} dataTest="working-list-table-loading" />
        ) : (
            this.renderRows(visibleColumns, columnsCount)
        );
    }

    renderRows(visibleColumns: Column[], columnsCount: number) {
        const { dataSource, rowIdKey, selectedRows, onRowSelect, ...customEndCellBodyProps } = this.props;

        if (!dataSource || dataSource.length === 0) {
            return (
                <DataTableRow dataTest="table-row">
                    <DataTableCell colSpan={columnsCount.toString()}>{i18n.t('No items to display')}</DataTableCell>
                </DataTableRow>
            );
        }

        return dataSource.map((row) => {
            const cells = visibleColumns.map((column: any) => (
                <DataTableCell
                    key={column.id}
                    align={Index.typesWithRightPlacement.includes(column.type) ? 'right' : 'left'}
                    style={{ cursor: this.props.isSelectionInProgress ? 'pointer' : 'default' }}
                    onClick={() => {
                        if (this.props.isSelectionInProgress) {
                            onRowSelect(row[rowIdKey]);
                            return;
                        }
                        if (this.isMembersFormPage()) {
                            this.props.onRowClick(row);
                            return;
                        }
                        this.myOnClickListRow(row);
                    }}
                >
                    {row[column.id]}
                </DataTableCell>
            ));

            const rowId = row[rowIdKey];
            return (
                <DataTableRow
                    selected={selectedRows[rowId]}
                    key={rowId}
                    dataTest={row[rowIdKey]}
                >
                    {this.props.showSelectCheckBox && (
                        <DataTableCell
                            width={'40px'}
                        >
                            <CheckboxField
                                dataTest={'select-row-checkbox'}
                                checked={selectedRows[rowId]}
                                onChange={() => onRowSelect(rowId)}
                            />
                        </DataTableCell>
                    )}
                    {cells}
                    {this.getCustomEndCellBody(row, customEndCellBodyProps)}
                </DataTableRow>
            );
        });
    }

    render() {
        const { classes, columns, updating } = this.props;
        const visibleColumns = columns ? columns.filter(column => column.visible) : [];
        return (
            <div className={classes.tableContainer}>
                <DataTable dataTest="online-list-table">
                    <DataTableHead>{this.renderHeaderRow(visibleColumns)}</DataTableHead>
                    <DataTableBody loading={Boolean(updating)}>{this.renderBody(visibleColumns)}</DataTableBody>
                </DataTable>
            </div>
        );
    }
}

const OnlineListBase = withStyles(getStyles as any)(withRouter(Index));
export const OnlineList = withApiUtils(OnlineListBase);
