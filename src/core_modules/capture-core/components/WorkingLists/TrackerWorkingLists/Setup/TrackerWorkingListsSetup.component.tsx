import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Props } from './trackerWorkingListsSetup.types';
import { WorkingListsBase } from '../../WorkingListsBase';
import { useMainViewConfig } from 'capture-core/components/Pages/MembersFormPage/MembersFormPageBody/WorkingListsType/EventWorkingListsInit/InitOnline/useMainViewConfig';
import { useSelectedMembersSection, setSelectedMembersSection } from '../../WorkingListsBase/membersSectionSelection.store';
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
import { isMembersFormPage as isMembersFormPageRoute } from '../../utils/isMembersFormPage';

const DEFAULT_TEMPLATES_LENGTH = 1;

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
    const isMembersFormPage = isMembersFormPageRoute();
    const { dataEntryPrograms } = useMainViewConfig();
    const dataEntryProgramStageId = useMemo(
        () => dataEntryPrograms?.find(entry => entry.program === program.id)?.programStage,
        [dataEntryPrograms, program.id],
    );
    const effectiveProgramStageId =
        isMembersFormPage ? (dataEntryProgramStageId || programStageId) : programStageId;
    const listQueryProgramStageId = effectiveProgramStageId;
    const selectedMembersSectionId = useSelectedMembersSection(effectiveProgramStageId);
    const defaultSectionId = useMemo(() => {
        if (!effectiveProgramStageId) {
            return undefined;
        }
        const programStage = program.stages.get(effectiveProgramStageId);
        if (!programStage) {
            return undefined;
        }
        return Array.from(programStage.stageForm.sections.values())
            .find(section => section.visible && section.name)?.id;
    }, [effectiveProgramStageId, program.stages]);
    const selectedSectionIdForColumns = isMembersFormPage
        ? (selectedMembersSectionId || defaultSectionId)
        : undefined;
    const customUpdateTriggerForSection = useMemo(
        () => (
            isMembersFormPage
                ? `${effectiveProgramStageId || ''}:${selectedSectionIdForColumns || ''}`
                : customUpdateTrigger
        ),
        [isMembersFormPage, customUpdateTrigger, effectiveProgramStageId, selectedSectionIdForColumns],
    );
    const prevProgramStageId = useRef(effectiveProgramStageId);
    const prevTemplateId = useRef(currentTemplateId);
    const defaultColumns = useDefaultColumnConfig(program, orgUnitId, effectiveProgramStageId, selectedSectionIdForColumns);
    const columns = useColumns<TrackerWorkingListsColumnConfigs>(customColumnOrder, defaultColumns);
    const filtersOnly = useFiltersOnly(program, effectiveProgramStageId);
    const programStageFiltersOnly = useProgramStageFilters(program, effectiveProgramStageId);
    const staticTemplates = useStaticTemplates(
        storedTemplates?.find(storedTemplate => storedTemplate.isDefault && storedTemplate.isAltered),
        `${program.id}-default`,
    );
    const templates = apiTemplates?.length > DEFAULT_TEMPLATES_LENGTH ? apiTemplates : staticTemplates;
    const currentTemplate = useCurrentTemplate(templates, currentTemplateId);
    const viewHasChanges = useViewHasTemplateChanges({
        initialViewConfig,
        defaultColumns,
        filters,
        columns,
        sortById,
        sortByDirection,
        isDefaultTemplateAltered: storedTemplates?.find(template => template.isDefault)?.isAltered,
    });

    const buildTemplateArgs = useCallback(() => buildArgumentsForTemplate({
        filters,
        filtersOnly,
        programStageFiltersOnly,
        columns,
        sortById,
        sortByDirection,
        programId: program.id,
        programStageId: listQueryProgramStageId,
    }), [
        filters,
        filtersOnly,
        programStageFiltersOnly,
        columns,
        sortById,
        sortByDirection,
        program.id,
        listQueryProgramStageId,
    ]);

    useEffect(() => {
        if (!isMembersFormPage || !effectiveProgramStageId) {
            return;
        }

        const programStage = program.stages.get(effectiveProgramStageId);
        if (!programStage) {
            return;
        }

        const visibleSections = Array.from(programStage.stageForm.sections.values())
            .filter(section => section.visible && section.name);
        if (!visibleSections.length) {
            return;
        }

        const isSelectedSectionValid = selectedMembersSectionId &&
            visibleSections.some(section => section.id === selectedMembersSectionId);
        if (!isSelectedSectionValid) {
            setSelectedMembersSection(effectiveProgramStageId, visibleSections[0].id);
        }
    }, [isMembersFormPage, effectiveProgramStageId, program.stages, selectedMembersSectionId]);

    useEffect(() => {
        const viewHasProgramStageChanges = viewHasChanges && effectiveProgramStageId !== prevProgramStageId.current;

        if (viewHasProgramStageChanges) {
            onResetListColumnOrder && onResetListColumnOrder();
            const defaultTemplateId = `${program.id}-default`;
            if (
                shouldPreserveViewState({
                    currentTemplateId,
                    defaultTemplateId,
                    programStageId: listQueryProgramStageId,
                    prevProgramStageId,
                    prevTemplateId,
                })
            ) {
                const { criteria } = buildTemplateArgs();

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
        listQueryProgramStageId,
        currentTemplateId,
        prevTemplateId,
        buildTemplateArgs,
    ]);

    const injectArgumentsForAddTemplate = useCallback(
        (name: string) => {
            const { criteria, data } = buildTemplateArgs();
            onAddTemplate(name, criteria, data);
        },
        [
            onAddTemplate,
            buildTemplateArgs,
        ],
    );

    const injectArgumentsForUpdateTemplate = useCallback(
        (template: any) => {
            const { criteria, data } = buildTemplateArgs();
            onUpdateTemplate(template, criteria, data);
        },
        [
            onUpdateTemplate,
            buildTemplateArgs,
        ],
    );

    const injectArgumentsForDeleteTemplate = useCallback(
        (template: any) => onDeleteTemplate(template, program.id, listQueryProgramStageId),
        [onDeleteTemplate, program.id, listQueryProgramStageId],
    );
    const dataSource = useDataSource(records, recordsOrder, columns);
    const onLoadViewWithMeta = useInjectDataFetchingMetaToLoadList(
        defaultColumns,
        filtersOnly,
        programStageFiltersOnly,
        onLoadView,
    );
    const onUpdateListWithMeta = useInjectDataFetchingMetaToUpdateList(
        defaultColumns,
        filtersOnly,
        programStageFiltersOnly,
        onUpdateList,
    );
    const onRowClickNoop = useCallback(() => {}, []);

    return (
        <WorkingListsBase
            {...passOnProps}
            forceUpdateOnMount={forceUpdateOnMount}
            currentTemplate={currentTemplate}
            customUpdateTrigger={customUpdateTriggerForSection}
            templates={templates}
            columns={columns}
            onAddTemplate={injectArgumentsForAddTemplate}
            onUpdateTemplate={injectArgumentsForUpdateTemplate}
            onDeleteTemplate={injectArgumentsForDeleteTemplate}
            filtersOnly={filtersOnly}
            additionalFilters={programStageFiltersOnly}
            dataSource={dataSource}
            onLoadView={onLoadViewWithMeta}
            onUpdateList={onUpdateListWithMeta}
            programId={program.id}
            programStageId={listQueryProgramStageId}
            rowIdKey="id"
            orgUnitId={orgUnitId}
            currentViewHasTemplateChanges={viewHasChanges}
            filters={filters}
            sortById={sortById}
            sortByDirection={sortByDirection}
            bulkActionBarComponent={bulkActionBarComponent}
            onClickListRow={isMembersFormPage ? onRowClickNoop : passOnProps.onClickListRow}
        />
    );
};
