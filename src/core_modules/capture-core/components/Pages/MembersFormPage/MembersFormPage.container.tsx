import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { connect, shallowEqual, useDispatch, useSelector } from 'react-redux';
import { programCollection } from 'capture-core/metaDataMemoryStores/programCollection/programCollection';
import { withLoadingIndicator } from '../../../HOC';
import { updateShowAccessibleStatus } from '../actions/crossPage.actions';
import { useNavigate, buildUrlQueryString, useLocationQuery } from '../../../utils/routing';
import { MainPageStatuses } from './shared/constants';
import { OrgUnitFetcher } from '../../OrgUnitFetcher';
import { useCategoryOptionIsValidForOrgUnit } from '../../../hooks/useCategoryComboIsValidForOrgUnit';
import { MembersFormPageComponent } from './MembersFormPage.component';
import { TrackerProgram } from '../../../metaData';

type ReduxState = {
    activePage: {
        selectionsError?: { error: boolean };
        lockedSelectorLoads: boolean;
        isLoading: boolean;
    };
    currentSelections: {
        categories: any;
        categoriesMeta: any;
    };
    workingListsTemplates: {
        teiList?: { selectedTemplateId: string };
    };
    workingListsContext: {
        teiList?: { programIdView: string };
    };
};

const mapStateToProps = (state: ReduxState) => ({
    error: state.activePage.selectionsError?.error, // TODO: Should probably remove this
    ready: !state.activePage.lockedSelectorLoads,  // TODO: Should probably remove this
});

const handleChangeTemplateUrl = ({
    sourceProgramId,
    entryProgram,
    orgUnitId,
    selectedTemplateId,
    showAllAccessible,
    navigate,
}: {
    sourceProgramId?: string;
    entryProgram: string;
    orgUnitId?: string;
    selectedTemplateId?: string;
    showAllAccessible: boolean;
    navigate: (url: string) => void;
}) => {
    const query = {
        ...(sourceProgramId ? { programId: sourceProgramId } : {}),
        entryProgram,
    };

    if (orgUnitId) {
        selectedTemplateId
            ? navigate(`/membersForm?${buildUrlQueryString({ ...query, orgUnitId, selectedTemplateId })}`)
            : navigate(`/membersForm?${buildUrlQueryString({ ...query, orgUnitId })}`);
    }
    if (showAllAccessible) {
        selectedTemplateId
            ? navigate(`/membersForm?${buildUrlQueryString({ ...query, selectedTemplateId })}&all`)
            : navigate(`/membersForm?${buildUrlQueryString(query)}&all`);
    }
};

const useMainPageStatus = ({
    programId,
    selectedProgram,
    categories,
    orgUnitId,
    showAllAccessible,
    categoryOptionIsInvalidForOrgUnit,
    showBulkDataEntryPlugin,
}: {
    programId?: string;
    selectedProgram?: any;
    categories?: any;
    orgUnitId?: string;
    showAllAccessible: boolean;
    categoryOptionIsInvalidForOrgUnit: boolean;
    showBulkDataEntryPlugin: boolean;
}) => {
    const withoutOrgUnit = useMemo(() => !orgUnitId && !showAllAccessible, [orgUnitId, showAllAccessible]);

    return useMemo(() => {
        if (showBulkDataEntryPlugin) return MainPageStatuses.SHOW_BULK_DATA_ENTRY_PLUGIN;

        if (!programId) return MainPageStatuses.DEFAULT;

        if (selectedProgram?.categoryCombination) {
            if (!categories) return MainPageStatuses.WITHOUT_PROGRAM_CATEGORY_SELECTED;
            const programCategories = Array.from(selectedProgram.categoryCombination.categories.values());
            if (programCategories.some((category: any) => !categories?.[category.id])) {
                return MainPageStatuses.WITHOUT_PROGRAM_CATEGORY_SELECTED;
            }
            if (withoutOrgUnit) {
                return MainPageStatuses.WITHOUT_ORG_UNIT_SELECTED;
            }
            if (programCategories && categoryOptionIsInvalidForOrgUnit) {
                return MainPageStatuses.CATEGORY_OPTION_INVALID_FOR_ORG_UNIT;
            }
            return MainPageStatuses.SHOW_WORKING_LIST;
        }

        if (withoutOrgUnit) {
            return MainPageStatuses.WITHOUT_ORG_UNIT_SELECTED;
        }

        return MainPageStatuses.SHOW_WORKING_LIST;
    }, [programId, selectedProgram, withoutOrgUnit, categories, categoryOptionIsInvalidForOrgUnit, showBulkDataEntryPlugin]);
};

const useSelectorMainPage = () =>
    useSelector(
        ({ currentSelections, activePage, workingListsTemplates, workingListsContext }: ReduxState) => ({
            categories: currentSelections.categories,
            selectedCategories: currentSelections.categoriesMeta,
            reduxSelectedTemplateId: workingListsTemplates.teiList?.selectedTemplateId,
            workingListProgramId: workingListsContext.teiList?.programIdView,
            ready: !activePage.isLoading && !activePage.lockedSelectorLoads,
            error: activePage.selectionsError?.error,
        }),
        shallowEqual,
    );

const useCallbackMainPage = ({
    orgUnitId,
    sourceProgramId,
    entryProgram,
    showAllAccessible,
    navigate,
    setShowBulkDataEntryPlugin,
    setBulkDataEntryTrackedEntityIds,
}: {
    orgUnitId?: string;
    sourceProgramId?: string;
    entryProgram?: string;
    showAllAccessible: boolean;
    navigate: (url: string) => void;
    setShowBulkDataEntryPlugin: (show: boolean) => void;
    setBulkDataEntryTrackedEntityIds: (ids?: Array<string>) => void;
}) => {
    const onChangeTemplate = useCallback(
        (id?: string) => handleChangeTemplateUrl({
            sourceProgramId,
            entryProgram: entryProgram || '',
            orgUnitId,
            selectedTemplateId: id,
            showAllAccessible,
            navigate,
        }),
        [navigate, orgUnitId, sourceProgramId, entryProgram, showAllAccessible],
    );

    const onSetShowAccessible = useCallback(
        () => navigate(`/membersForm?${buildUrlQueryString({
            ...(sourceProgramId ? { programId: sourceProgramId } : {}),
            ...(entryProgram ? { entryProgram } : {}),
        })}&all`),
        [navigate, sourceProgramId, entryProgram],
    );

    const onCloseBulkDataEntryPlugin = useCallback(() => {
        setBulkDataEntryTrackedEntityIds(undefined);
        setShowBulkDataEntryPlugin(false);
    }, [setBulkDataEntryTrackedEntityIds, setShowBulkDataEntryPlugin]);

    const onOpenBulkDataEntryPlugin = useCallback((trackedEntityIds?: Array<string>) => {
        setBulkDataEntryTrackedEntityIds(trackedEntityIds);
        setShowBulkDataEntryPlugin(true);
    }, [setBulkDataEntryTrackedEntityIds, setShowBulkDataEntryPlugin]);

    return {
        onChangeTemplate,
        onSetShowAccessible,
        onCloseBulkDataEntryPlugin,
        onOpenBulkDataEntryPlugin,
    };
};

const MainPageContainer = () => {
    const [showBulkDataEntryPlugin, setShowBulkDataEntryPlugin] = useState(false);
    const [bulkDataEntryTrackedEntityIds, setBulkDataEntryTrackedEntityIds] = useState<Array<string> | undefined>(undefined);

    const dispatch = useDispatch();
    const { navigate } = useNavigate();
    const { all, programId: sourceProgramId, entryProgram, orgUnitId, selectedTemplateId } = useLocationQuery();
    const programId = entryProgram || sourceProgramId;
    const showAllAccessible = all !== undefined;

    const {
        categories,
        selectedCategories,
        reduxSelectedTemplateId,
        workingListProgramId,
        error,
        ready,
    } = useSelectorMainPage();
    const { categoryOptionIsInvalidForOrgUnit } = useCategoryOptionIsValidForOrgUnit({ selectedOrgUnitId: orgUnitId });

    const selectedProgram = programCollection.get(programId);
    const trackedEntityType = (selectedProgram &&
        selectedProgram instanceof TrackerProgram) ? selectedProgram.trackedEntityType : undefined;
    const trackedEntityTypeId = trackedEntityType?.id;
    const displayFrontPageList = Boolean(trackedEntityTypeId && selectedProgram?.displayFrontPageList);
    const mainPageStatus = useMainPageStatus({
        programId,
        selectedProgram,
        categories,
        orgUnitId,
        showAllAccessible,
        categoryOptionIsInvalidForOrgUnit,
        showBulkDataEntryPlugin,
    });

    const { onChangeTemplate, onSetShowAccessible, onCloseBulkDataEntryPlugin, onOpenBulkDataEntryPlugin } =
        useCallbackMainPage({
            orgUnitId,
            sourceProgramId,
            entryProgram: programId,
            showAllAccessible,
            navigate,
            setShowBulkDataEntryPlugin,
            setBulkDataEntryTrackedEntityIds,
        });

    useEffect(() => {
        dispatch(updateShowAccessibleStatus(showAllAccessible));
    }, [showAllAccessible, dispatch]);

    useEffect(() => {
        if (programId && trackedEntityTypeId && selectedTemplateId === undefined) {
            if (reduxSelectedTemplateId && workingListProgramId === programId) {
                handleChangeTemplateUrl({
                    sourceProgramId,
                    entryProgram: programId,
                    orgUnitId,
                    selectedTemplateId: reduxSelectedTemplateId,
                    showAllAccessible,
                    navigate,
                });
                return;
            }
            if (!displayFrontPageList) return;
            handleChangeTemplateUrl({
                sourceProgramId,
                entryProgram: programId,
                orgUnitId,
                selectedTemplateId: `${programId}-default`,
                showAllAccessible,
                navigate,
            });
        }
    }, [
        selectedTemplateId,
        orgUnitId,
        programId,
        sourceProgramId,
        showAllAccessible,
        trackedEntityTypeId,
        displayFrontPageList,
        navigate,
        reduxSelectedTemplateId,
        workingListProgramId,
    ]);

    return (
        <OrgUnitFetcher orgUnitId={orgUnitId} error={error}>
            <MembersFormPageComponent
                programId={programId}
                sourceProgramId={sourceProgramId}
                entryProgramId={programId}
                orgUnitId={orgUnitId}
                selectedCategories={selectedCategories}
                mainPageStatus={mainPageStatus}
                trackedEntityTypeId={trackedEntityTypeId}
                selectedTemplateId={selectedTemplateId}
                onSetShowAccessible={onSetShowAccessible}
                onChangeTemplate={onChangeTemplate}
                error={error}
                ready={ready}
                displayFrontPageList={displayFrontPageList}
                onCloseBulkDataEntryPlugin={onCloseBulkDataEntryPlugin}
                onOpenBulkDataEntryPlugin={onOpenBulkDataEntryPlugin}
                bulkDataEntryTrackedEntityIds={bulkDataEntryTrackedEntityIds}
            />
        </OrgUnitFetcher>
    );
};

export const MembersFormPage = connect(mapStateToProps)(withLoadingIndicator()(MainPageContainer));
