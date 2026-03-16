import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';
// @ts-expect-error - SelectorBarItem is available at runtime, but its TypeScript definition is not exposed by the UI library
import { SelectorBarItem } from '@dhis2/ui';
import { FEATURES, featureAvailable } from 'capture-core-utils';
import { programCollection } from 'capture-core/metaDataMemoryStores/programCollection/programCollection';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import {
    ScopeSelector,
    useSetProgramId,
    useSetOrgUnitId,
    useResetProgramId,
    useResetOrgUnitId,
    useReset,
    setOrgUnitFromScopeSelector,
} from '../../../ScopeSelector';
import {
    setCategoryOption,
    resetCategoryOption,
    resetAllCategoryOptions,
} from '../shared/actions/mainPage.actions';
import type { TopBarProps } from './topBar.types';
import { useLocationQuery } from 'capture-core/utils/routing';
import { OptionLabel } from '../../../ScopeSelector/OptionLabel';
import {
    useAvailableMembersVisitDates,
    setDefaultMembersVisitDate,
    setSelectedMembersVisitDate,
    useSelectedMembersVisitDate,
} from '../../../WorkingLists/WorkingListsBase/membersVisitDate.store';
import { TRACKER_WORKING_LISTS_STORE_ID } from '../../../WorkingLists/TrackerWorkingLists/constants/trackerWorkingListsType';
import { EventDateSelector } from './EventDateSelector.component';

const FAMILY_NAME_ATTRIBUTE_ID = 'a8GQzSXuCH7';
type EventDateOption = {
    value: string;
    label: string;
};

const isDefinedString = (value: string | undefined): value is string => typeof value === 'string' && value.length > 0;

const masterTeiQuery: any = {
    results: {
        resource: 'tracker/trackedEntities',
        params: ({ masterTeiId }) => ({
            [featureAvailable(FEATURES.newEntityFilterQueryParam) ? 'trackedEntities' : 'trackedEntity']: masterTeiId,
            fields: 'trackedEntity,attributes[attribute,value]',
            page: 1,
            pageSize: 1,
        }),
    },
};

export const TopBar = ({ sourceProgramId, entryProgramId, orgUnitId, selectedCategories }: TopBarProps) => {
    const dispatch = useDispatch();
    const { masterTEI } = useLocationQuery();
    const entryProgram = entryProgramId ? programCollection.get(entryProgramId) : null;
    const { setProgramId } = useSetProgramId();
    const { setOrgUnitId } = useSetOrgUnitId();
    const { resetProgramIdAndSelectedTemplateId } = useResetProgramId();
    const { resetOrgUnitId } = useResetOrgUnitId();
    const { reset } = useReset();
    const { data: masterTeiData, refetch: refetchMasterTei } = useDataQuery(masterTeiQuery, { lazy: true });
    const availableMembersVisitDates = useAvailableMembersVisitDates();
    const selectedMembersVisitDate = useSelectedMembersVisitDate();
    const [cachedEventDates, setCachedEventDates] = useState<string[]>([]);
    const hasAppliedDefaultEventDateRef = useRef(false);
    const { records, recordsOrder } = useSelector(({
        workingListsListRecords,
        workingLists,
    }: any) => ({
        records: workingListsListRecords[TRACKER_WORKING_LISTS_STORE_ID],
        recordsOrder: workingLists[TRACKER_WORKING_LISTS_STORE_ID]?.order || [],
    }), shallowEqual);

    const dispatchOnSetCategoryOption = useCallback(
        (categoryOption: Record<string, any>, categoryId: string) => {
            dispatch(setCategoryOption(categoryId, categoryOption));
        },
        [dispatch],
    );
    const dispatchOnResetCategoryOption = useCallback(
        (categoryId: string) => {
            dispatch(resetCategoryOption(categoryId));
        },
        [dispatch],
    );
    const dispatchOnResetAllCategoryOptions = useCallback(() => {
        dispatch(resetAllCategoryOptions());
    }, [dispatch]);

    const dispatchOnSetOrgUnit = useCallback(
        (id: string) => {
            setOrgUnitId(id);
            dispatch(setOrgUnitFromScopeSelector(id));
        },
        [dispatch, setOrgUnitId],
    );
    const selectedFamilyName = useMemo(() => {
        const masterTeiResults = masterTeiData?.results as any;
        const trackedEntity =
            masterTeiResults?.trackedEntities?.[0]
            || masterTeiResults?.instances?.[0];
        return trackedEntity?.attributes
            ?.find(({ attribute }) => attribute === FAMILY_NAME_ATTRIBUTE_ID)
            ?.value;
    }, [masterTeiData, masterTEI]);
    const eventDateOptions = useMemo<EventDateOption[]>(() => {
        const eventDatesFromRecords: string[] = (recordsOrder || [])
            .map((recordId: string) => records?.[recordId]?.__occurredAt?.slice(0, 10))
            .filter(isDefinedString);

        const eventDates = availableMembersVisitDates.length
            ? availableMembersVisitDates
            : (cachedEventDates.length ? cachedEventDates : eventDatesFromRecords);

        return Array.from(new Set<string>(eventDates))
            .sort((a, b) => b.localeCompare(a))
            .map((date: string) => ({
                value: date,
                label: date,
            }));
    }, [availableMembersVisitDates, cachedEventDates, records, recordsOrder]);

    useEffect(() => {
        if (masterTEI) {
            refetchMasterTei({ masterTeiId: masterTEI });
        }
    }, [masterTEI, refetchMasterTei]);

    useEffect(() => {
        const nextEventDates = (recordsOrder || [])
            .map((recordId: string) => records?.[recordId]?.__occurredAt?.slice(0, 10))
            .filter(isDefinedString);

        if (!nextEventDates.length) {
            return;
        }

        setCachedEventDates(currentDates => Array.from(new Set([...currentDates, ...nextEventDates]))
            .sort((a, b) => b.localeCompare(a)));
    }, [records, recordsOrder]);

    useEffect(() => {
        setCachedEventDates([]);
        hasAppliedDefaultEventDateRef.current = false;
        setDefaultMembersVisitDate(undefined);
    }, [masterTEI, entryProgramId]);

    useEffect(() => {
        if (hasAppliedDefaultEventDateRef.current || selectedMembersVisitDate || !eventDateOptions.length) {
            return;
        }

        setDefaultMembersVisitDate(eventDateOptions[0].value);
        hasAppliedDefaultEventDateRef.current = true;
    }, [eventDateOptions, selectedMembersVisitDate]);

    return (
        <ScopeSelector
            selectedProgramId={sourceProgramId}
            selectedOrgUnitId={orgUnitId}
            selectedCategories={selectedCategories}
            onSetProgramId={id => setProgramId(id)}
            onSetOrgUnit={id => dispatchOnSetOrgUnit(id)}
            onResetProgramId={() => resetProgramIdAndSelectedTemplateId()}
            onResetOrgUnitId={() => resetOrgUnitId()}
            onSetCategoryOption={dispatchOnSetCategoryOption}
            onResetAllCategoryOptions={dispatchOnResetAllCategoryOptions}
            onResetCategoryOption={dispatchOnResetCategoryOption}
            onStartAgain={() => reset()}
        >
            <EventDateSelector
                selectedValue={selectedMembersVisitDate}
                options={eventDateOptions}
                onSelect={setSelectedMembersVisitDate}
            />
            <SelectorBarItem
                label="Entry program"
                value={entryProgram && <OptionLabel icon={entryProgram.icon} label={entryProgram.name} />}
                displayOnly
            />
            <SelectorBarItem
                label="Familia"
                value={selectedFamilyName || ''}
                displayOnly
            />
        </ScopeSelector>
    );
};
