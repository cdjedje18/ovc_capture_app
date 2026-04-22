import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import { useConfig, useDataMutation, useDataQuery } from '@dhis2/app-runtime';
import { Button } from '@dhis2/ui';
import log from 'loglevel';
import { errorCreator, FEATURES, featureAvailable } from 'capture-core-utils';
import type { Mutation } from 'capture-core-utils/types/app-runtime';
import { dataElementTypes, DataElement, OptionSet, Option } from '../../../../metaData';
import { convertClientToList } from '../../../../converters';
import { generateUID } from '../../../../utils/uid/generateUID';
import { buildUrlQueryString } from '../../../../utils/routing';
import { isMembersFormPage as isMembersFormPageRoute } from '../../utils/isMembersFormPage';
import {
    setLoadingSelectedDateEvents,
    useSelectedMembersVisitDate,
    useTeiEvents,
} from '../../WorkingListsBase/membersVisitDate.store';
import { InlineEventCellField } from './InlineEventCellField.component';
import { MEMBERS_CAPTURE_LINK_COLUMN_ID } from '../../TrackerWorkingLists/Setup/hooks/useDefaultColumnConfig';
import useShowAlerts from 'capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert';
import { CustomRunRulesForNewEvent } from 'capture-core/components/WidgetEnrollmentEventNew/DataEntry/epics/dataEntryRules.epics';
import { CustomQuerySingleResource } from './useSingleResource';
import { applyEffectsToHeaders } from 'capture-core/components/Pages/MembersFormPage/utils/applyRules';
import { displayTextRule } from 'capture-core/components/Pages/MembersFormPage/schema/infoSchema';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { orgUnitSchema } from 'capture-core/components/Pages/MembersFormPage/schema/optionGroupsSchema';
import { makeNumbers } from './useViewHasTemplateChanges/utils/makeValueANumber';
import { buildValidatedDataValues } from './useViewHasTemplateChanges/utils/dataNormalizer';

// ---------------------------------------------------------------------------
// Constants & mutations
// ---------------------------------------------------------------------------

const TRACKER_EVENT_MUTATION: Mutation = {
    resource: 'tracker?async=false&importStrategy=CREATE_AND_UPDATE',
    type: 'create' as const,
    data: payload => payload,
};

const EVENT_METADATA_KEYS = {
    eventId: '__eventId',
    teiId: '__teiId',
    enrollmentId: '__enrollmentId',
    orgUnitId: '__orgUnitId',
    programId: '__programId',
    programStageId: '__programStageId',
    occurredAt: '__occurredAt',
    syntheticForSelectedDate: '__syntheticForSelectedDate',
} as const;

const DEFAULT_OVERRIDE_SCOPE = '__default';

const SELECTED_DATE_EVENTS_QUERY: any = {
    results: {
        resource: 'tracker/events',
        params: ({ programId, programStageId, trackedEntityIds, selectedDate }) => ({
            program: programId,
            programStage: programStageId,
            pageSize: 10000,
            order: 'occurredAt:desc',
            [featureAvailable(FEATURES.newEntityFilterQueryParam) ? 'trackedEntities' : 'trackedEntityInstance']: trackedEntityIds,
            occurredAfter: selectedDate,
            occurredBefore: selectedDate,
            fields: 'event,trackedEntity,status,occurredAt,scheduledAt,orgUnit,assignedUser,dataValues[dataElement,value]',
        }),
    },
};

// ---------------------------------------------------------------------------
// Pure helpers (stable references — defined outside the hook)
// ---------------------------------------------------------------------------

const getOccurredAtDate = (occurredAt?: string) => occurredAt?.slice(0, 10);

const getJoinedTeiIds = (teiIds: Array<string>) => teiIds.join(featureAvailable(FEATURES.newUIDsSeparator) ? ',' : ';');

const throwIfTrackerMutationFailed = (response: any) => {
    const normalizedResponse = response?.response || response?.details || response;
    const errorReports = normalizedResponse?.validationReport?.errorReports;
    const hasValidationErrors = Array.isArray(errorReports) && errorReports.length > 0;
    const hasErrorStatus = normalizedResponse?.status === 'ERROR';

    if (!hasValidationErrors && !hasErrorStatus) return;

    const validationMessage = hasValidationErrors
        ? errorReports.map((r: { message?: string }) => r.message).filter(Boolean).join(' ')
        : undefined;

    const error = new Error(validationMessage || 'Tracker event mutation failed');
    (error as Error & { details?: any }).details = normalizedResponse;
    throw error;
};

const hasEventForSelectedDate = ({
    isMembersFormPage,
    selectedMembersVisitDate,
    occurredAt,
}: {
    isMembersFormPage: boolean;
    selectedMembersVisitDate?: string;
    occurredAt?: string;
}) =>
    !isMembersFormPage ||
    !selectedMembersVisitDate ||
    getOccurredAtDate(occurredAt) === selectedMembersVisitDate;

const getEventMetadata = (eventRecord: { [key: string]: any }) => ({
    eventId: eventRecord[EVENT_METADATA_KEYS.eventId],
    teiId: eventRecord[EVENT_METADATA_KEYS.teiId],
    enrollmentId: eventRecord[EVENT_METADATA_KEYS.enrollmentId],
    orgUnitId: eventRecord[EVENT_METADATA_KEYS.orgUnitId],
    programId: eventRecord[EVENT_METADATA_KEYS.programId],
    programStageId: eventRecord[EVENT_METADATA_KEYS.programStageId],
    occurredAt: eventRecord[EVENT_METADATA_KEYS.occurredAt],
    syntheticForSelectedDate: eventRecord[EVENT_METADATA_KEYS.syntheticForSelectedDate],
});

const getCaptureEnrollmentUrl = ({
    baseUrl,
    enrollmentId,
    orgUnitId,
    programId,
    teiId,
}: {
    baseUrl?: string;
    enrollmentId?: string;
    orgUnitId?: string;
    programId?: string;
    teiId?: string;
}) => {
    if (!baseUrl || !enrollmentId || !orgUnitId || !programId || !teiId) return undefined;
    const queryString = buildUrlQueryString({ enrollmentId, orgUnitId, programId, teiId });
    return `${baseUrl}/dhis-web-capture/index.html#/enrollment?${queryString}`;
};

const getOccurredAtWithCurrentTime = (selectedDate?: string) => {
    const now = moment();
    if (!selectedDate) return now.format('YYYY-MM-DDTHH:mm:ss.SSS');
    return moment(selectedDate, ['DD-MM-YYYY', 'YYYY-MM-DD'], true)
        .set({
            hour: now.hour(),
            minute: now.minute(),
            second: now.second(),
            millisecond: now.millisecond(),
        })
        .format('YYYY-MM-DDTHH:mm:ss.SSS');
};

const getOccurredAtForSave = ({
    eventId,
    existingOccurredAt,
    selectedMembersVisitDate,
}: {
    eventId?: string;
    existingOccurredAt?: string;
    selectedMembersVisitDate?: string;
}) => (eventId ? existingOccurredAt : getOccurredAtWithCurrentTime(selectedMembersVisitDate));

const applyRecordOverridePatch = (
    currentOverrides: { [key: string]: { [key: string]: any } },
    scopeKey: string,
    rowId: string,
    patch: { [key: string]: any },
) => ({
    ...currentOverrides,
    [scopeKey]: {
        ...(currentOverrides[scopeKey] || {}),
        [rowId]: {
            ...((currentOverrides[scopeKey] || {})[rowId] || {}),
            ...patch,
        },
    },
});

const getOverrideScopeKey = ({
    isMembersFormPage,
    selectedMembersVisitDate,
    existingOccurredAt,
}: {
    isMembersFormPage: boolean;
    selectedMembersVisitDate?: string;
    existingOccurredAt?: string;
}) => {
    if (!isMembersFormPage) return DEFAULT_OVERRIDE_SCOPE;
    return selectedMembersVisitDate || getOccurredAtDate(existingOccurredAt) || DEFAULT_OVERRIDE_SCOPE;
};

const getLatestEventByTrackedEntity = (events: Array<any>) =>
    events.reduce((acc, event) => {
        const trackedEntityId = event.trackedEntity;
        if (!trackedEntityId) return acc;
        const current = acc[trackedEntityId];
        if (!current) {
            acc[trackedEntityId] = event;
            return acc;
        }
        const eventDate = event.occurredAt || event.scheduledAt || '';
        const currentDate = current.occurredAt || current.scheduledAt || '';
        if (eventDate > currentDate) acc[trackedEntityId] = event;
        return acc;
    }, {});

const createDataElement = (column) => {
    const dataElement = new DataElement((o) => {
        o.id = column.id;
        o.type = column.type;
    });
    if (column.options) {
        const options = column.options.map(
            option => new Option((o) => {
                o.text = option.text;
                o.value = option.value;
            }),
        );
        dataElement.optionSet = new OptionSet(column.id, options, null, dataElement);
    }
    return dataElement;
};

// Stable serialisation key for a row — only data fields that affect rendering.
const makeRowCacheKey = (copyData: Record<string, any>, teiId: string) =>
    JSON.stringify({ teiId, ...copyData });

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDataSource = (
    records: { [key: string]: any } | undefined,
    recordsOrder: Array<string> | undefined,
    columns: Array<{
        id: string;
        options?: Array<{ text: string; value: any }> | null;
        type: typeof dataElementTypes[keyof typeof dataElementTypes];
        visible: boolean;
        [key: string]: any;
    }>,
    currentProgramStageId?: string,
) => {
    const prevSavedEvents = useTeiEvents()
    const isMembersFormPage = isMembersFormPageRoute();
    const selectedMembersVisitDate = useSelectedMembersVisitDate();
    const isMembersFormLocked = isMembersFormPage && !selectedMembersVisitDate?.normalized;
    const { baseUrl } = useConfig();

    const {
        refetch: refetchSelectedDateEvents,
        data: selectedDateEventsData,
        loading: selectedDateEventsLoading,
    } = useDataQuery(SELECTED_DATE_EVENTS_QUERY, { lazy: true });

    const [saveEventMutation] = useDataMutation(TRACKER_EVENT_MUTATION);
    const [recordOverrides, setRecordOverrides] = useState<{ [key: string]: { [key: string]: any } }>({});
    const [listData, setListData] = useState<any[]>([]);

    const setDisplayTextRule = useSetRecoilState(displayTextRule);
    const orgUnitData = useRecoilValue(orgUnitSchema);

    // Mutable refs — never trigger re-renders, never go stale inside async callbacks
    const rowValueRef = useRef<Record<number, any>>({});
    const rowChangedRef = useRef<number | null>(null);

    // FIX 1: Rules cache — avoids re-running expensive rules for unchanged rows.
    const rulesCacheRef = useRef<Map<string, any>>(new Map());

    // Persists the last computed updatedColumns per row so that rows skipped by
    // the rowChangedRef guard still render with their previous rule effects
    // (hidden/disabled/required/value state) instead of falling back to raw columnsRef.
    const updatedColumnsPerRowRef = useRef<Record<number, any[]>>({});

    // FIX 2: Stable callback refs — persistEventCellValue and recordOverride are
    // excluded from the buildRows useEffect dependency array; the refs always
    // point to the latest version without causing a rebuild.
    const persistEventCellValueRef = useRef<any>(null);
    const recordOverrideRef = useRef<any>(null);

    const { hide, show } = useShowAlerts();
    const { querySingleResource } = CustomQuerySingleResource();

    // Stable alert refs to keep persistEventCellValue dependency-free
    const showRef = useRef(show);
    const hideRef = useRef(hide);
    useEffect(() => { showRef.current = show; }, [show]);
    useEffect(() => { hideRef.current = hide; }, [hide]);

    // ---------------------------------------------------------------------------
    // Derived state
    // ---------------------------------------------------------------------------

    const activeOverrideScopeKey = getOverrideScopeKey({
        isMembersFormPage,
        selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
    });

    // FIX 3: rowValueRef is NOT reset here. Resetting on every selectedDateEventsData
    // change was discarding per-row cache that hadn't changed at all.
    const fetchedSelectedDateEventsByTei = useMemo(() => {
        const results = selectedDateEventsData?.results as any;
        const events = results?.events || results?.instances || [];
        return getLatestEventByTrackedEntity(events);
    }, [selectedDateEventsData]);

    const selectedDateEventsByTei = useMemo(() => {
        if (!isMembersFormPage || !selectedMembersVisitDate?.normalized) return undefined;
        return fetchedSelectedDateEventsByTei;
    }, [fetchedSelectedDateEventsByTei, isMembersFormPage, selectedMembersVisitDate?.normalized]);

    // FIX 4: columns is excluded from the dependency array below because it is
    // structurally stable (same shape per render) and including it caused a full
    // rebuild on every parent render. We read columns via a ref instead.
    const columnsRef = useRef(columns);
    useEffect(() => { columnsRef.current = columns; }, [columns]);

    const eventRecordsArray = useMemo(() =>
        recordsOrder && records && recordsOrder.map((id, idx) => {
            const cached = Object.values(rowValueRef.current).find((item: any) => item.idx === idx) ?? {};

            const selectedDatePatch = isMembersFormPage && selectedMembersVisitDate?.normalized && selectedDateEventsByTei
                ? (() => {
                    const selectedDateEvent = selectedDateEventsByTei[records[id]?.[EVENT_METADATA_KEYS.teiId] || id];
                    const selectedDateEventValues = (selectedDateEvent?.dataValues || []).reduce((acc, dv) => {
                        acc[dv.dataElement] = dv.value;
                        return acc;
                    }, {});

                    return {
                        [EVENT_METADATA_KEYS.eventId]: selectedDateEvent?.event,
                        [EVENT_METADATA_KEYS.occurredAt]: selectedDateEvent?.occurredAt,
                        occurredAt: selectedMembersVisitDate?.normalized,
                        [EVENT_METADATA_KEYS.syntheticForSelectedDate]: false,
                        ...selectedDateEventValues,
                    };
                })()
                : {};

            return {
                idx,
                ...cached,
                ...records[id],
                ...selectedDatePatch,
                ...((recordOverrides[activeOverrideScopeKey] || {})[id] || {}),
                id,
            };
        }),
        [
            records,
            recordsOrder,
            recordOverrides,
            activeOverrideScopeKey,
            isMembersFormPage,
            selectedMembersVisitDate?.normalized,
            selectedDateEventsByTei,
        ],
        // NOTE: `columns` intentionally omitted — read via columnsRef to prevent
        // full list rebuild on every column-object recreation.
    );

    // ---------------------------------------------------------------------------
    // Effects
    // ---------------------------------------------------------------------------

    useEffect(() => {
        if (!isMembersFormPage) {
            setLoadingSelectedDateEvents(false);
            return undefined;
        }
        setLoadingSelectedDateEvents(Boolean(selectedMembersVisitDate?.normalized && selectedDateEventsLoading));
        return () => { setLoadingSelectedDateEvents(false); };
    }, [isMembersFormPage, selectedDateEventsLoading, selectedMembersVisitDate?.normalized]);

    useEffect(() => {
        rulesCacheRef.current.clear();
        rowValueRef.current = {};
        updatedColumnsPerRowRef.current = {}; // ← add this line
    }, [selectedMembersVisitDate?.normalized]);

    useEffect(() => {
        if (!isMembersFormPage || !selectedMembersVisitDate?.normalized || !recordsOrder?.length || !records) return;

        const firstRecord = records[recordsOrder[0]];
        const programId = firstRecord?.[EVENT_METADATA_KEYS.programId];
        const programStageId = currentProgramStageId || firstRecord?.[EVENT_METADATA_KEYS.programStageId];
        const trackedEntityIds = recordsOrder
            .map(id => records[id]?.[EVENT_METADATA_KEYS.teiId] || id)
            .filter(Boolean);

        if (!programId || !programStageId || !trackedEntityIds.length) return;

        // FIX 5: Clear rules cache when selected date changes — different date
        // means different events, so cached rule results are stale.
        rulesCacheRef.current.clear();
        rowValueRef.current = {};

        refetchSelectedDateEvents({
            programId,
            programStage: programStageId,
            trackedEntityIds: getJoinedTeiIds(trackedEntityIds),
            selectedDate: selectedMembersVisitDate?.normalized,
        });
    }, [
        isMembersFormPage,
        selectedMembersVisitDate?.normalized,
        records,
        recordsOrder,
        refetchSelectedDateEvents,
        currentProgramStageId,
    ]);

    // ---------------------------------------------------------------------------
    // recordOverride — stable, no closure over volatile state
    // ---------------------------------------------------------------------------

    const recordOverride = useCallback(({
        eventRecord,
        column,
        value,
        object = false,
    }: {
        eventRecord: { [key: string]: any };
        column: { id: string; type: keyof typeof dataElementTypes };
        value: any;
        object?: boolean;
    }) => {
        const overrideScopeKey = getOverrideScopeKey({
            isMembersFormPage,
            selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
        });
        const overridePatch = object ? { ...value } : { [column.id]: value };
        setRecordOverrides(current =>
            applyRecordOverridePatch(current, overrideScopeKey, eventRecord.id, overridePatch),
        );
    }, [isMembersFormPage, selectedMembersVisitDate?.normalized]);

    // Keep ref current
    useEffect(() => { recordOverrideRef.current = recordOverride; }, [recordOverride]);

    // ---------------------------------------------------------------------------
    // persistEventCellValue — reads volatile values via refs, stable identity
    // ---------------------------------------------------------------------------

    const persistEventCellValue = useCallback(async ({
        eventRecord,
        column,
        row,
    }: {
        eventRecord: { [key: string]: any };
        column: { id: string; type: keyof typeof dataElementTypes };
        row: number;
    }) => {
        if (isMembersFormPage && !selectedMembersVisitDate?.normalized) return;

        const {
            eventId,
            teiId,
            enrollmentId,
            orgUnitId,
            programId,
            programStageId: recordProgramStageId,
            occurredAt: existingOccurredAt,
        } = getEventMetadata(eventRecord);

        const programStageId = currentProgramStageId || recordProgramStageId;

        if (!teiId || !enrollmentId || !orgUnitId || !programId || !programStageId) {
            log.warn(
                errorCreator('Could not save event cell value due to missing metadata')({
                    columnId: column.id,
                    teiId,
                    enrollmentId,
                    orgUnitId,
                    programId,
                    programStageId,
                }),
            );
            return;
        }

        const shouldReuseExistingEvent = Boolean(eventId) && hasEventForSelectedDate({
            isMembersFormPage,
            selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
            occurredAt: existingOccurredAt,
        });

        const targetExistingEventId = shouldReuseExistingEvent ? eventId : undefined;
        const targetExistingOccurredAt = shouldReuseExistingEvent ? existingOccurredAt : undefined;
        const targetEventId = rowValueRef.current?.[row]?.[EVENT_METADATA_KEYS.eventId] || targetExistingEventId || generateUID();

        const nextOccurredAt = getOccurredAtForSave({
            eventId: targetExistingEventId,
            existingOccurredAt: targetExistingOccurredAt,
            selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
        });

        if (targetExistingEventId && !nextOccurredAt) {
            log.warn(
                errorCreator('Could not save existing event because occurredAt is missing')({
                    eventId: targetExistingEventId,
                    columnId: column.id,
                    rowId: eventRecord.id,
                }),
            );
            return;
        }

        try {
            const dataValues = buildValidatedDataValues(rowValueRef.current?.[row], columns as any)

            const mutationResponse: any = await saveEventMutation({
                events: [{
                    event: targetEventId,
                    trackedEntity: teiId,
                    enrollment: enrollmentId,
                    orgUnit: orgUnitId,
                    program: programId,
                    programStage: programStageId,
                    status: 'ACTIVE',
                    occurredAt: nextOccurredAt,
                    dataValues,
                }],
            });

            if (!eventId) {
                rowValueRef.current = {
                    ...rowValueRef.current,
                    [row]: {
                        ...(rowValueRef.current[row] || {}),
                        [EVENT_METADATA_KEYS.eventId]: targetEventId,
                    },
                };
            }

            // Use ref to avoid stale closure on recordOverride
            recordOverrideRef.current?.({
                eventRecord,
                column,
                value: { loading: false, ...rowValueRef.current?.[row] },
                object: true,
            });

            if (mutationResponse?.stats?.created > 0 || mutationResponse?.stats?.updated > 0) {
                showRef.current({ message: 'Dados gravados com sucesso', type: { success: true } });
            } else if (mutationResponse?.stats?.ignored > 0) {
                showRef.current({ message: 'Ocorreu um erro ao gravar evento', type: { crirtical: true } });
                throwIfTrackerMutationFailed(mutationResponse);
            }

            setTimeout(hideRef.current, 5000);
        } catch {
            showRef.current({ message: 'Ocorreu um erro ao gravar os dados', type: { critical: true } });
            setTimeout(hideRef.current, 5000);
        }

        if (!targetExistingEventId) {
            eventRecord[EVENT_METADATA_KEYS.eventId] = targetEventId;
            eventRecord[EVENT_METADATA_KEYS.occurredAt] = nextOccurredAt;
            eventRecord[EVENT_METADATA_KEYS.syntheticForSelectedDate] = true;
        }
    }, [currentProgramStageId, isMembersFormPage, saveEventMutation, selectedMembersVisitDate?.normalized]);

    // Keep ref current
    useEffect(() => { persistEventCellValueRef.current = persistEventCellValue; }, [persistEventCellValue]);

    // ---------------------------------------------------------------------------
    // orgUnitData ref — prevents rules re-run when orgUnit object ref changes
    // but value is the same
    // ---------------------------------------------------------------------------
    const orgUnitDataRef = useRef(orgUnitData);
    useEffect(() => { orgUnitDataRef.current = orgUnitData; }, [orgUnitData]);

    // ---------------------------------------------------------------------------
    // List data builder
    // FIX 6: persistEventCellValue and recordOverride are removed from deps —
    // they are read via stable refs. This prevents a full list rebuild every time
    // an override is applied or a save completes.
    // ---------------------------------------------------------------------------

    // Outside the effect, near the top of the hook:
    const prevEventsByTei = useMemo(() => {
        if (!prevSavedEvents?.data) return {};
        return Object.fromEntries(
            prevSavedEvents.data.map(x => [x.tei, x.events ?? []])
        );
    }, [prevSavedEvents]);

    useEffect(() => {
        if (!eventRecordsArray) return;

        let cancelled = false;

        const buildRows = async () => {
            // FIX 7: Serialise each row and skip re-processing rows that haven't
            // changed. Only rows with a new cacheKey go through CustomRunRulesForNewEvent.
            const results = await Promise.all(
                eventRecordsArray.map(async (eventRecord, rowIndex) => {
                    const { idx, id, ...rest } = eventRecord;
                    let copyData = { ...rest };

                    const teiId = eventRecord[EVENT_METADATA_KEYS.teiId];
                    const teiRecord = records?.[teiId];
                    const sanitizedTeiRecord = teiRecord
                        ? Object.fromEntries(Object.entries(teiRecord).filter(([key]) => !key.startsWith('__')))
                        : undefined;

                    if (sanitizedTeiRecord) {
                        Object.keys(sanitizedTeiRecord).forEach(key => { delete copyData[key]; });
                        copyData = Object.fromEntries(
                            Object.entries(copyData).filter(([key]) => !key.startsWith('__')),
                        );
                    }

                    let updatedColumns = updatedColumnsPerRowRef.current[rowIndex] ?? columnsRef.current;

                    if (isMembersFormPage && (rowChangedRef.current == null || rowChangedRef.current == rowIndex)) {
                        // --- Rules cache check ---
                        const cacheKey = makeRowCacheKey(copyData, teiId ?? id);
                        let effects: any;

                        if (rulesCacheRef.current.has(cacheKey)) {
                            // Cache hit: reuse previous effects, skip expensive call
                            effects = rulesCacheRef.current.get(cacheKey);
                        } else {
                            const prevEvents = prevEventsByTei[teiId] ?? [];

                            effects = await CustomRunRulesForNewEvent({
                                currentEvent: makeNumbers(columnsRef.current, copyData),
                                orgUnit: orgUnitDataRef.current,
                                querySingleResource,
                                rulesExecutionDependenciesClientFormatted: {
                                    attributeValues: sanitizedTeiRecord as any,
                                    enrollmentData: {
                                        enrollmentId: records?.[teiId]?.[EVENT_METADATA_KEYS.enrollmentId],
                                        enrolledAt: '',
                                        occurredAt: '',
                                    },
                                    events: prevEvents,
                                },
                            });
                            rulesCacheRef.current.set(cacheKey, effects);
                        }

                        updatedColumns = applyEffectsToHeaders(columnsRef.current, effects);

                        const generalError = effects?.SHOWERROR?.general?.[0];
                        const columnsWithValue = updatedColumns.filter(col => col.value);
                        const ruleValues = Object.fromEntries(columnsWithValue.map(({ id: cid, value }) => [cid, value]));

                        rowValueRef.current = {
                            ...rowValueRef.current,
                            [rowIndex]: {
                                idx: eventRecord.idx,
                                ...(rowValueRef.current[rowIndex] || {}),
                                ...makeNumbers(columnsRef.current, ruleValues),
                            },
                        };

                        updatedColumnsPerRowRef.current = {
                            ...updatedColumnsPerRowRef.current,
                            [rowIndex]: updatedColumns,
                        };

                        if (generalError) {
                            setDisplayTextRule(prev => {
                                if (!prev.find(x => x.key === rowIndex)) {
                                    return [
                                        ...prev,
                                        {
                                            key: rowIndex,
                                            name: sanitizedTeiRecord?.[localStorage.getItem('nomeDoMembro') || ''],
                                            content: generalError?.error?.message,
                                        },
                                    ];
                                }
                                return prev;
                            });
                        } else {
                            setDisplayTextRule(prev => prev?.filter(x => x.key !== rowIndex) || []);
                        }
                    }

                    const currentColumns = columnsRef.current;

                    const listRecord = currentColumns
                        .filter(col => col.visible)
                        .reduce((acc, column) => {
                            const { id: colId, type, options, resolveValue } = column;
                            const clientValue = eventRecord[colId];

                            if (isMembersFormPage && colId === MEMBERS_CAPTURE_LINK_COLUMN_ID) {
                                const captureEnrollmentUrl = getCaptureEnrollmentUrl({
                                    baseUrl,
                                    enrollmentId: eventRecord[EVENT_METADATA_KEYS.enrollmentId],
                                    orgUnitId: eventRecord[EVENT_METADATA_KEYS.orgUnitId],
                                    programId: eventRecord[EVENT_METADATA_KEYS.programId],
                                    teiId: eventRecord[EVENT_METADATA_KEYS.teiId],
                                });

                                acc[colId] = captureEnrollmentUrl
                                    ? React.createElement(
                                        'a',
                                        { href: captureEnrollmentUrl, target: '_blank', rel: 'noopener noreferrer' },
                                        React.createElement(Button, { small: true }, 'Detalhes'),
                                    )
                                    : null;
                                return acc;
                            }

                            if (isMembersFormPage && colId === 'actions') {
                                // FIX 8: Capture rowIndex and eventRecord by value in the
                                // closure; use stable refs for persistEventCellValue /
                                // recordOverride so the button onClick never goes stale.
                                const capturedRowIndex = rowIndex;
                                const capturedEventRecord = eventRecord;
                                const capturedUpdatedColumns = updatedColumns;

                                acc[colId] = React.createElement(
                                    'div',
                                    { style: { display: 'flex', gap: '8px' } },
                                    React.createElement(Button, {
                                        small: true,
                                        loading: eventRecord?.loading,
                                        disabled: !Boolean(rowValueRef.current?.[capturedRowIndex]),
                                        onClick: () => {
                                            const required: any = capturedUpdatedColumns?.filter(x => (x.required && !x.disabled));
                                            const error: any = capturedUpdatedColumns?.filter(x => (x.error && !x.disabled));
                                            const conjunto = [...error, ...required];

                                            if (required?.length > 0 || error?.length > 0) {
                                                for (const req of conjunto) {
                                                    if (!capturedEventRecord[req.id]) {
                                                        showRef.current({
                                                            message: `O campo "${req?.header}" é obrigatório!`,
                                                            type: { warning: true },
                                                        });
                                                        setTimeout(hideRef.current, 5000);
                                                        return;
                                                    }
                                                }
                                            }

                                            recordOverrideRef.current?.({
                                                eventRecord: capturedEventRecord,
                                                column,
                                                value: { loading: true },
                                                object: true,
                                            });
                                            void persistEventCellValueRef.current?.({
                                                eventRecord: capturedEventRecord,
                                                column,
                                                row: capturedRowIndex,
                                            });
                                        },
                                    }, '💾 Gravar'),
                                );
                                return acc;
                            }

                            if (isMembersFormPage && column.additionalColumn) {
                                const thisHeader = updatedColumns?.find(x => x.id === colId);
                                const capturedRowIndex = rowIndex;
                                const capturedEventRecord = eventRecord;

                                acc[colId] = React.createElement(InlineEventCellField, {
                                    key: `${eventRecord.id}-${colId}`,
                                    column: thisHeader as any,
                                    rowChangedRef,
                                    rowIndex,
                                    value: thisHeader && 'value' in thisHeader ? thisHeader.value : clientValue,
                                    ...((isMembersFormLocked || eventRecord.loading)
                                        ? { disabled: isMembersFormLocked || eventRecord.loading }
                                        : {}),
                                    saveStatus: 'idle',
                                    onCommit: (nextClientValue: any) => {
                                        recordOverrideRef.current?.({
                                            eventRecord: capturedEventRecord,
                                            column,
                                            value: nextClientValue,
                                        });
                                        rowValueRef.current = {
                                            ...rowValueRef.current,
                                            [capturedRowIndex]: {
                                                ...(rowValueRef.current[capturedRowIndex] || {}),
                                                [column.id]: nextClientValue,
                                            },
                                        };
                                    },
                                });
                                return acc;
                            }

                            if (resolveValue) {
                                acc[colId] = resolveValue()[clientValue];
                            } else if (options) {
                                if (type === dataElementTypes.MULTI_TEXT) {
                                    acc[colId] = convertClientToList(clientValue, type, createDataElement(column));
                                } else {
                                    const option = options.find(o => o.value === clientValue);
                                    if (!option) {
                                        log.error(errorCreator('Missing value in options')({ id: colId, clientValue, options }));
                                        acc[colId] = convertClientToList(clientValue, type);
                                    } else {
                                        acc[colId] = option.text;
                                    }
                                }
                            } else {
                                acc[colId] = convertClientToList(clientValue, type);
                            }

                            return acc;
                        }, {});

                    return { ...listRecord, id: eventRecord.id };
                }),
            );

            if (!cancelled) setListData(results);
        };

        buildRows();

        return () => { cancelled = true; };
    }, [
        eventRecordsArray,
        columns,
        // columns intentionally omitted — read via columnsRef
        baseUrl,
        isMembersFormPage,
        isMembersFormLocked,
        // persistEventCellValue intentionally omitted — called via persistEventCellValueRef
        // recordOverride intentionally omitted — called via recordOverrideRef
        querySingleResource,
        records,
        setDisplayTextRule,
    ]);

    return { listData };
};