import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Props } from './trackerWorkingListsSetup.types';
import { WorkingListsBase } from '../../WorkingListsBase';
import {
    useDefaultColumnConfig,
    useFiltersOnly,
    useInjectDataFetchingMetaToLoadList,
    useInjectDataFetchingMetaToUpdateList,
    useProgramStageFilters,
    useStaticTemplates,
} from './hooks';
import { useColumns, useDataSource, useViewHasTemplateChanges } from '../../WorkingListsCommon';
import type { TrackerWorkingListsColumnConfigs } from '../types';
import { buildArgumentsForTemplate } from '../helpers';

const DEFAULT_TEMPLATES_LENGTH = 1;
const FIXED_PROGRAM_STAGE_ID = 'wYTF0YCHMWr';

const shouldPreserveViewState = ({
    currentTemplateId,
    prevTemplateId,
    defaultTemplateId,
    programStageId,
    prevProgramStageId,
}: {
    currentTemplateId?: string;
    prevTemplateId: React.MutableRefObject<string | undefined>;
    defaultTemplateId: string;
    programStageId?: string;
    prevProgramStageId: React.MutableRefObject<string | undefined>;
}) =>
    currentTemplateId !== defaultTemplateId &&
    currentTemplateId === prevTemplateId.current &&
    ((programStageId && prevProgramStageId.current === undefined) ||
        (programStageId === undefined && prevProgramStageId.current));

const useCurrentTemplate = (templates: any[], currentTemplateId?: string) => useMemo(() =>
    (currentTemplateId && templates.find(template => template.id === currentTemplateId)) || templates[0],
[templates, currentTemplateId]);

export const TrackerWorkingListsSetup = ({
    program,
    programStageId,
    onUpdateList,
    onLoadView,
    onClearFilters,
    onResetListColumnOrder,
    onPreserveCurrentViewState,
    customColumnOrder,
    records,
    recordsOrder,
    currentTemplateId,
    initialViewConfig,
    filters,
    sortById,
    sortByDirection,
    orgUnitId,
    apiTemplates,
    templates: storedTemplates,
    onAddTemplate,
    onUpdateTemplate,
    onDeleteTemplate,
    forceUpdateOnMount,
    customUpdateTrigger,
    bulkActionBarComponent,
    ...passOnProps
}: Props) => {
    const effectiveProgramStageId = programStageId || FIXED_PROGRAM_STAGE_ID;
    const prevProgramStageId = useRef(effectiveProgramStageId);
    const prevTemplateId = useRef(currentTemplateId);
    const defaultColumns = useDefaultColumnConfig(program, orgUnitId, effectiveProgramStageId);
    const columns = useColumns<TrackerWorkingListsColumnConfigs>(customColumnOrder, defaultColumns);
    const filtersOnly = useFiltersOnly(program, effectiveProgramStageId);
    const programStageFiltersOnly = useProgramStageFilters(program, effectiveProgramStageId);
    const staticTemplates = useStaticTemplates(
        storedTemplates?.find(storedTemplate => storedTemplate.isDefault && storedTemplate.isAltered),
        `${program.id}-default`,
    );
    const templates = apiTemplates?.length > DEFAULT_TEMPLATES_LENGTH ? apiTemplates : staticTemplates;
    const viewHasChanges = useViewHasTemplateChanges({
        initialViewConfig,
        defaultColumns,
        filters,
        columns,
        sortById,
        sortByDirection,
        isDefaultTemplateAltered: storedTemplates?.find(template => template.isDefault)?.isAltered,
    });

    useEffect(() => {
        const viewHasProgramStageChanges = viewHasChanges && effectiveProgramStageId !== prevProgramStageId.current;

        if (viewHasProgramStageChanges) {
            onResetListColumnOrder && onResetListColumnOrder();
            const defaultTemplateId = `${program.id}-default`;
            if (
                shouldPreserveViewState({
                    currentTemplateId,
                    defaultTemplateId,
                    programStageId: effectiveProgramStageId,
                    prevProgramStageId,
                    prevTemplateId,
                })
            ) {
                const { criteria } = buildArgumentsForTemplate({
                    filters,
                    filtersOnly,
                    programStageFiltersOnly,
                    columns,
                    sortById,
                    sortByDirection,
                    programId: program.id,
                    programStageId: effectiveProgramStageId,
                });

                onPreserveCurrentViewState(defaultTemplateId, criteria);
            }
        }
        prevTemplateId.current = currentTemplateId;
        prevProgramStageId.current = effectiveProgramStageId;
    }, [
        effectiveProgramStageId,
        onResetListColumnOrder,
        viewHasChanges,
        program,
        onPreserveCurrentViewState,
        filters,
        filtersOnly,
        programStageFiltersOnly,
        columns,
        sortById,
        sortByDirection,
        currentTemplateId,
        prevTemplateId,
    ]);

    const injectArgumentsForAddTemplate = useCallback(
        (name: string) => {
            const { criteria, data } = buildArgumentsForTemplate({
                filters,
                filtersOnly,
                programStageFiltersOnly,
                columns,
                sortById,
                sortByDirection,
                programId: program.id,
                programStageId: effectiveProgramStageId,
            });
            onAddTemplate(name, criteria, data);
        },
        [
            onAddTemplate,
            filters,
            filtersOnly,
            programStageFiltersOnly,
            columns,
            sortById,
            sortByDirection,
            program.id,
            effectiveProgramStageId,
        ],
    );

    const injectArgumentsForUpdateTemplate = useCallback(
        (template: any) => {
            const { criteria, data } = buildArgumentsForTemplate({
                filters,
                filtersOnly,
                programStageFiltersOnly,
                columns,
                sortById,
                sortByDirection,
                programId: program.id,
                programStageId: effectiveProgramStageId,
            });
            onUpdateTemplate(template, criteria, data);
        },
        [
            onUpdateTemplate,
            filters,
            filtersOnly,
            programStageFiltersOnly,
            columns,
            sortById,
            sortByDirection,
            program.id,
            effectiveProgramStageId,
        ],
    );

    const injectArgumentsForDeleteTemplate = useCallback(
        (template: any) => onDeleteTemplate(template, program.id, effectiveProgramStageId),
        [onDeleteTemplate, program.id, effectiveProgramStageId],
    );

    return (
        <WorkingListsBase
            {...passOnProps}
            forceUpdateOnMount={forceUpdateOnMount}
            currentTemplate={useCurrentTemplate(templates, currentTemplateId)}
            customUpdateTrigger={customUpdateTrigger}
            templates={templates}
            columns={columns}
            onAddTemplate={injectArgumentsForAddTemplate}
            onUpdateTemplate={injectArgumentsForUpdateTemplate}
            onDeleteTemplate={injectArgumentsForDeleteTemplate}
            filtersOnly={filtersOnly}
            additionalFilters={programStageFiltersOnly}
            dataSource={useDataSource(records, recordsOrder, columns)}
            onLoadView={useInjectDataFetchingMetaToLoadList(
                defaultColumns,
                filtersOnly,
                programStageFiltersOnly,
                onLoadView,
            )}
            onUpdateList={useInjectDataFetchingMetaToUpdateList(
                defaultColumns,
                filtersOnly,
                programStageFiltersOnly,
                onUpdateList,
            )}
            programId={program.id}
            programStageId={effectiveProgramStageId}
            rowIdKey="id"
            orgUnitId={orgUnitId}
            currentViewHasTemplateChanges={viewHasChanges}
            filters={filters}
            sortById={sortById}
            sortByDirection={sortByDirection}
            bulkActionBarComponent={bulkActionBarComponent}
        />
    );
};
