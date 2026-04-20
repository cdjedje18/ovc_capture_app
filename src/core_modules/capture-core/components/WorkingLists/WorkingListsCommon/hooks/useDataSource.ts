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

const getOccurredAtDate = (occurredAt?: string) => occurredAt?.slice(0, 10);

const getJoinedTeiIds = (teiIds: Array<string>) =>
    teiIds.join(featureAvailable(FEATURES.newUIDsSeparator) ? ',' : ';');

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
    const rowValueRef = useRef({});

    const { hide, show } = useShowAlerts();
    const { querySingleResource } = CustomQuerySingleResource();

    // Derived state ----------------------------------------------------------

    const activeOverrideScopeKey = getOverrideScopeKey({
        isMembersFormPage,
        selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
    });

    const fetchedSelectedDateEventsByTei = useMemo(() => {
        rowValueRef.current = {};
        const results = selectedDateEventsData?.results as any;
        const events = results?.events || results?.instances || [];
        return getLatestEventByTrackedEntity(events);
    }, [selectedDateEventsData]);

    const selectedDateEventsByTei = useMemo(() => {
        if (!isMembersFormPage || !selectedMembersVisitDate?.normalized) return undefined;
        return fetchedSelectedDateEventsByTei;
    }, [fetchedSelectedDateEventsByTei, isMembersFormPage, selectedMembersVisitDate?.normalized]);

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
            columns,
        ],
    );

    // Effects ----------------------------------------------------------------

    useEffect(() => {
        if (!isMembersFormPage) {
            setLoadingSelectedDateEvents(false);
            return undefined;
        }

        setLoadingSelectedDateEvents(Boolean(selectedMembersVisitDate?.normalized && selectedDateEventsLoading));

        return () => { setLoadingSelectedDateEvents(false); };
    }, [isMembersFormPage, selectedDateEventsLoading, selectedMembersVisitDate?.normalized]);

    useEffect(() => {
        if (!isMembersFormPage || !selectedMembersVisitDate?.normalized || !recordsOrder?.length || !records) return;

        const firstRecord = records[recordsOrder[0]];
        const programId = firstRecord?.[EVENT_METADATA_KEYS.programId];
        const programStageId = currentProgramStageId || firstRecord?.[EVENT_METADATA_KEYS.programStageId];
        const trackedEntityIds = recordsOrder
            .map(id => records[id]?.[EVENT_METADATA_KEYS.teiId] || id)
            .filter(Boolean);

        if (!programId || !programStageId || !trackedEntityIds.length) return;

        refetchSelectedDateEvents({
            programId,
            programStageId,
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

    const persistEventCellValue = useCallback(async ({
        eventRecord,
        column,
        row,
    }: {
        eventRecord: { [key: string]: any };
        column: { id: string; type: keyof typeof dataElementTypes };
        row: any;
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
            const { [EVENT_METADATA_KEYS.eventId]: _, ...restRowValues } = rowValueRef?.current?.[row] || {};
            const dataValues = Object.entries(restRowValues).map(([dataElement, value]) => ({ dataElement, value }));

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

            recordOverride({
                eventRecord,
                column,
                value: { loading: false, ...rowValueRef?.current?.[row] },
                object: true,
            });

            if (mutationResponse?.stats?.created > 0 || mutationResponse?.stats?.updated > 0) {
                show({ message: 'Dados gravados com sucesso', type: { success: true } });
            } else if (mutationResponse?.stats?.ignored > 0) {
                show({ message: 'Ocorreu um erro ao gravar evento', type: { crirtical: true } });
                throwIfTrackerMutationFailed(mutationResponse);
            }

            setTimeout(hide, 5000);
        } catch {
            show({ message: 'Ocorreu um erro ao gravar os dados', type: { critical: true } });
            setTimeout(hide, 5000);
        }

        if (!targetExistingEventId) {
            eventRecord[EVENT_METADATA_KEYS.eventId] = targetEventId;
            eventRecord[EVENT_METADATA_KEYS.occurredAt] = nextOccurredAt;
            eventRecord[EVENT_METADATA_KEYS.syntheticForSelectedDate] = true;
        }
    }, [currentProgramStageId, isMembersFormPage, saveEventMutation, selectedMembersVisitDate?.normalized, recordOverride]);

    // List data builder ------------------------------------------------------

    useEffect(() => {
        if (!eventRecordsArray) return;

        let cancelled = false;

        const buildRows = async () => {
            const results = await Promise.all(
                eventRecordsArray.map(async (eventRecord, rowIndex) => {
                    const { idx, id, ...rest } = eventRecord;
                    let copyData = { ...rest };

                    const teiRecord = records?.[eventRecord[EVENT_METADATA_KEYS.teiId]];
                    const sanitizedTeiRecord = teiRecord
                        ? Object.fromEntries(Object.entries(teiRecord).filter(([key]) => !key.startsWith('__')))
                        : undefined;

                    if (sanitizedTeiRecord) {
                        Object.keys(sanitizedTeiRecord).forEach(key => { delete copyData[key]; });
                        copyData = Object.fromEntries(
                            Object.entries(copyData).filter(([key]) => !key.startsWith('__')),
                        );
                    }

                    let updatedColumns = columns;

                    if (isMembersFormPage) {
                        const effects: any = await CustomRunRulesForNewEvent({
                            currentEvent: makeNumbers(columns, copyData),
                            orgUnit: orgUnitData,
                            querySingleResource,
                            rulesExecutionDependenciesClientFormatted: {
                                attributeValues: sanitizedTeiRecord as any,
                                enrollmentData: {
                                    enrollmentId: records?.[eventRecord[EVENT_METADATA_KEYS.teiId]]?.[EVENT_METADATA_KEYS.enrollmentId],
                                    enrolledAt: '',
                                    occurredAt: '',
                                },
                                events: [],
                            },
                        });

                        updatedColumns = applyEffectsToHeaders(columns, effects);

                        const generalError = effects?.SHOWERROR?.general?.[0];
                        const columnsWithValue = updatedColumns.filter(col => col.value);
                        const ruleValues = Object.fromEntries(columnsWithValue.map(({ id, value }) => [id, value]));

                        rowValueRef.current = {
                            ...rowValueRef.current,
                            [rowIndex]: {
                                idx: eventRecord.idx,
                                ...(rowValueRef.current[rowIndex] || {}),
                                ...makeNumbers(columns, ruleValues),
                            },
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

                    const listRecord = columns
                        .filter(col => col.visible)
                        .reduce((acc, column) => {
                            const { id, type, options, resolveValue } = column;
                            const clientValue = eventRecord[id];

                            if (isMembersFormPage && id === MEMBERS_CAPTURE_LINK_COLUMN_ID) {
                                const captureEnrollmentUrl = getCaptureEnrollmentUrl({
                                    baseUrl,
                                    enrollmentId: eventRecord[EVENT_METADATA_KEYS.enrollmentId],
                                    orgUnitId: eventRecord[EVENT_METADATA_KEYS.orgUnitId],
                                    programId: eventRecord[EVENT_METADATA_KEYS.programId],
                                    teiId: eventRecord[EVENT_METADATA_KEYS.teiId],
                                });

                                acc[id] = captureEnrollmentUrl
                                    ? React.createElement(
                                        'a',
                                        { href: captureEnrollmentUrl, target: '_blank', rel: 'noopener noreferrer' },
                                        React.createElement(Button, { small: true }, 'Detalhes'),
                                    )
                                    : null;
                                return acc;
                            }

                            if (isMembersFormPage && id === 'actions') {
                                acc[id] = React.createElement(
                                    'div',
                                    { style: { display: 'flex', gap: '8px' } },
                                    React.createElement(Button, {
                                        small: true,
                                        loading: eventRecord?.loading,
                                        disabled: !Boolean(rowValueRef.current?.[rowIndex]),
                                        onClick: () => {
                                            const required: any = updatedColumns?.filter(x => x.required);
                                            const error: any = updatedColumns?.filter(x => x.error);
                                            const conjunto = [...error, ...required];

                                            if (required?.length > 0 || error?.length > 0) {
                                                for (const req of conjunto) {
                                                    if (!eventRecord[req.id]) {
                                                        show({
                                                            message: `O campo "${req?.header}" é obrigatório!`,
                                                            type: { warning: true },
                                                        });
                                                        setTimeout(hide, 5000);
                                                        return;
                                                    }
                                                }
                                            }

                                            recordOverride({ eventRecord, column, value: { loading: true }, object: true });
                                            void persistEventCellValue({ eventRecord, column, row: rowIndex });
                                        },
                                    }, '💾 Gravar'),
                                );
                                return acc;
                            }

                            if (isMembersFormPage && column.additionalColumn) {
                                const thisHeader = updatedColumns?.find(x => x.id === column.id);

                                acc[id] = React.createElement(InlineEventCellField, {
                                    key: `${eventRecord.id}-${id}`,
                                    column: thisHeader as any,
                                    value: thisHeader && 'value' in thisHeader ? thisHeader.value : clientValue,
                                    ...((isMembersFormLocked || eventRecord.loading)
                                        ? { disabled: isMembersFormLocked || eventRecord.loading }
                                        : {}),
                                    saveStatus: 'idle',
                                    onCommit: (nextClientValue: any) => {
                                        recordOverride({ eventRecord, column, value: nextClientValue });
                                        rowValueRef.current = {
                                            ...rowValueRef.current,
                                            [rowIndex]: {
                                                ...(rowValueRef.current[rowIndex] || {}),
                                                [column.id]: nextClientValue,
                                            },
                                        };
                                    },
                                });
                                return acc;
                            }

                            if (resolveValue) {
                                acc[id] = resolveValue()[clientValue];
                            } else if (options) {
                                if (type === dataElementTypes.MULTI_TEXT) {
                                    acc[id] = convertClientToList(clientValue, type, createDataElement(column));
                                } else {
                                    const option = options.find(o => o.value === clientValue);
                                    if (!option) {
                                        log.error(errorCreator('Missing value in options')({ id, clientValue, options }));
                                        acc[id] = convertClientToList(clientValue, type);
                                    } else {
                                        acc[id] = option.text;
                                    }
                                }
                            } else {
                                acc[id] = convertClientToList(clientValue, type);
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
        baseUrl,
        isMembersFormPage,
        isMembersFormLocked,
        persistEventCellValue,
        recordOverride,
    ]);

    return { listData };
};