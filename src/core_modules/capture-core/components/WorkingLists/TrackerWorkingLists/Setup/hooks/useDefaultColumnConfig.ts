import { useMemo } from 'react';
import i18n from '@dhis2/d2-i18n';
import { ADDITIONAL_FILTERS, ADDITIONAL_FILTERS_LABELS } from '../../helpers';
import { dataElementTypes, type TrackerProgram } from '../../../../../metaData';
import type { MainColumnConfig, MetadataColumnConfig, TrackerWorkingListsColumnConfigs } from '../../types';
import { isMembersFormPage as isMembersFormPageRoute } from '../../../utils/isMembersFormPage';

const getMainConfig = (
    hasDisplayInReportsAttributes: boolean,
    hideInColumnSelector?: boolean,
): Array<MainColumnConfig> =>
    [
        {
            id: 'programOwnerId',
            visible: false,
            type: dataElementTypes.ORGANISATION_UNIT,
            header: i18n.t('Owner organisation unit'),
            sortDisabled: true,
            apiViewName: 'programOwner',
        },
        {
            id: 'createdAt',
            visible: !hasDisplayInReportsAttributes,
            type: dataElementTypes.DATE,
            header: i18n.t('Registration Date'),
            filterHidden: true,
        },
        {
            id: 'inactive',
            visible: false,
            type: dataElementTypes.BOOLEAN,
            header: i18n.t('Inactive'),
            filterHidden: true,
        },
    ].map(field => ({
        ...field,
        mainProperty: true,
        hideInColumnSelector,
    }));

const getProgramStageMainConfig = (
    programStage,
    hideProgramStageMainColumns: boolean,
    hideInColumnSelector?: boolean,
): Array<MetadataColumnConfig> =>
    [
        {
            id: ADDITIONAL_FILTERS.status,
            visible: !hideProgramStageMainColumns,
            type: dataElementTypes.TEXT,
            header: i18n.t(ADDITIONAL_FILTERS_LABELS.status),
        },
        {
            id: ADDITIONAL_FILTERS.occurredAt,
            visible: !hideProgramStageMainColumns,
            type: dataElementTypes.DATE,
            header: programStage.stageForm.getLabel('occurredAt') || i18n.t(ADDITIONAL_FILTERS_LABELS.occurredAt),
        },
        ...(programStage.hideDueDate === false
            ? [
                {
                    id: ADDITIONAL_FILTERS.scheduledAt,
                    visible: !hideProgramStageMainColumns,
                    type: dataElementTypes.DATE,
                    header:
                        programStage.stageForm.getLabel('scheduledAt') ||
                        i18n.t(ADDITIONAL_FILTERS_LABELS.scheduledAt),
                },
            ]
            : []),
        {
            id: ADDITIONAL_FILTERS.orgUnit,
            visible: !hideProgramStageMainColumns,
            type: dataElementTypes.ORGANISATION_UNIT,
            header: ADDITIONAL_FILTERS_LABELS.orgUnit,
            apiViewName: 'eventOrgUnit',
        },
        ...(programStage.enableUserAssignment
            ? [
                {
                    id: ADDITIONAL_FILTERS.assignedUser,
                    visible: !hideProgramStageMainColumns,
                    type: dataElementTypes.ASSIGNEE,
                    header: i18n.t(ADDITIONAL_FILTERS_LABELS.assignee),
                },
            ]
            : []),
    ].map(field => ({
        ...field,
        mainProperty: true,
        filterHidden: true,
        additionalColumn: true,
        hideInColumnSelector,
    }));

const getEventsMetaDataConfig = (
    programStage,
    selectedSectionId?: string,
    forceVisible?: boolean,
    hideInColumnSelector?: boolean,
): Array<MetadataColumnConfig> => {
    const stageForm = programStage.stageForm;
    if (!stageForm) {
        return [];
    }

    if (!selectedSectionId) {
        return getDataValuesMetaDataConfig([...stageForm.getElements()], forceVisible, hideInColumnSelector);
    }

    const selectedSection = stageForm.getSection(selectedSectionId);
    if (!selectedSection) {
        return [];
    }

    const dataElementsInSection = Array.from(selectedSection.elements.values()).reduce((acc, element: any) => {
        if (element?.fields && typeof element.fields.values === 'function') {
            return acc.concat(Array.from(element.fields.values()));
        }
        return acc.concat(element);
    }, []);

    return getDataValuesMetaDataConfig(dataElementsInSection, forceVisible, hideInColumnSelector);
};

const MEMBERS_FORM_VISIBLE_ATTRIBUTE_ID = 'PP0L2IEL4Dm';

const getTEIMetaDataConfig = (
    attributes: Array<any>,
    orgUnitId: string | null | undefined,
    isMembersFormPage?: boolean,
): Array<MetadataColumnConfig> =>
    attributes.map(({
        id,
        displayInReports,
        type,
        name,
        formName,
        optionSet,
        searchable,
        unique,
        searchOperator,
        minCharactersToSearch }) => ({
        id,
        visible: isMembersFormPage ? id === MEMBERS_FORM_VISIBLE_ATTRIBUTE_ID : displayInReports,
        type,
        header: formName || name,
        options: optionSet && optionSet.options.map(({ text, value }) => ({ text, value })),
        multiValueFilter: isMembersFormPage ? false : (!!optionSet || type === dataElementTypes.BOOLEAN),
        filterHidden: isMembersFormPage ? id !== MEMBERS_FORM_VISIBLE_ATTRIBUTE_ID : !(orgUnitId || searchable || unique),
        hideInColumnSelector: isMembersFormPage ? id !== MEMBERS_FORM_VISIBLE_ATTRIBUTE_ID : false,
        unique: Boolean(unique),
        searchOperator,
        minCharactersToSearch,
    }));

const getDataValuesMetaDataConfig = (
    dataElements,
    forceVisible?: boolean,
    hideInColumnSelector?: boolean,
): Array<MetadataColumnConfig> =>
    dataElements.map(({ id, displayInReports, type, name, formName, optionSet }) => ({
        id,
        visible: forceVisible ? true : displayInReports,
        type,
        header: formName || name,
        options: optionSet && optionSet.options.map(({ text, value }) => ({ text, value })),
        multiValueFilter: !!optionSet,
        additionalColumn: true,
        hideInColumnSelector,
    }));

export const useDefaultColumnConfig = (
    program: TrackerProgram,
    orgUnitId: string | null | undefined,
    programStageId: string | null | undefined,
    selectedSectionId?: string,
): TrackerWorkingListsColumnConfigs =>
    useMemo(() => {
        const { attributes, stages } = program;
        const programStage = programStageId && stages.get(programStageId);
        const isMembersFormPage = isMembersFormPageRoute();
        const hasDisplayInReportsAttributes = attributes.some(attribute => attribute.displayInReports);

        const defaultColumns = [
            ...getMainConfig(hasDisplayInReportsAttributes, isMembersFormPage),
            ...getTEIMetaDataConfig(attributes, orgUnitId, isMembersFormPage),
        ];

        if (programStageId && programStage) {
            const shouldForceVisibleDataElements = isMembersFormPage && !!selectedSectionId;
            return defaultColumns.concat([
                ...getProgramStageMainConfig(programStage, isMembersFormPage, false),
                ...getEventsMetaDataConfig(
                    programStage,
                    isMembersFormPage ? selectedSectionId : undefined,
                    shouldForceVisibleDataElements,
                    false,
                ),
            ]);
        }
        return defaultColumns;
    }, [orgUnitId, program, programStageId, selectedSectionId]);
