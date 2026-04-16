import React, { useCallback, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import { useConfig, useDataMutation, useDataQuery } from '@dhis2/app-runtime';
import { Button } from '@dhis2/ui';
import log from 'loglevel';
import { v4 as uuid } from 'uuid';
import { errorCreator, FEATURES, featureAvailable } from 'capture-core-utils';
import type { Mutation } from 'capture-core-utils/types/app-runtime';
import { dataElementTypes, DataElement, OptionSet, Option } from '../../../../metaData';
import { convertClientToList, convertClientToServer, convertServerToClient } from '../../../../converters';
import { generateUID } from '../../../../utils/uid/generateUID';
import { buildUrlQueryString } from '../../../../utils/routing';
import { isMembersFormPage as isMembersFormPageRoute } from '../../utils/isMembersFormPage';
import {
    setLoadingSelectedDateEvents,
    useSelectedMembersVisitDate,
} from '../../WorkingListsBase/membersVisitDate.store';
import { InlineEventCellField } from './InlineEventCellField.component';
import { MEMBERS_CAPTURE_LINK_COLUMN_ID } from '../../TrackerWorkingLists/Setup/hooks/useDefaultColumnConfig';
import { getFilterApiName } from '../../TrackerWorkingLists/helpers';
import { CustomDhis2RulesEngine } from 'capture-core/components/Pages/MembersFormPage/hooks/programRules/rules-engine/RulesEngine';
import useShowAlerts from 'capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert';
import { startRunRulesPostUpdateField } from 'capture-core/components/DataEntry';
import { executeRulesOnUpdateForNewEvent } from 'capture-core/components/WidgetEnrollmentEventNew/DataEntry/actions/dataEntry.actions';
import { runRulesForNewEvent } from 'capture-core/components/WidgetEnrollmentEventNew/DataEntry/epics/dataEntryRules.epics';

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

const SELECTED_DATE_EVENTS_QUERY: any = {
    results: {
        resource: 'tracker/events',
        params: ({ programId, programStageId, trackedEntityIds, selectedDate }) => ({
            program: programId,
            programStage: programStageId,
            pageSize: 10000,
            order: 'occurredAt:desc',
            [featureAvailable(FEATURES.newEntityFilterQueryParam) ? 'trackedEntities' : 'trackedEntity']: trackedEntityIds,
            occurredAfter: selectedDate,
            occurredBefore: selectedDate,
            fields: 'event,trackedEntity,status,occurredAt,scheduledAt,orgUnit,assignedUser,dataValues[dataElement,value]',
        }),
    },
};

const getOccurredAtDate = (occurredAt?: string) => occurredAt?.slice(0, 10);
const DEFAULT_OVERRIDE_SCOPE = '__default';
const getJoinedTeiIds = (teiIds: Array<string>) => teiIds.join(featureAvailable(FEATURES.newUIDsSeparator) ? ',' : ';');

const throwIfTrackerMutationFailed = (response: any) => {
    const normalizedResponse = response?.response || response?.details || response;
    const errorReports = normalizedResponse?.validationReport?.errorReports;
    const hasValidationErrors = Array.isArray(errorReports) && errorReports.length > 0;
    const hasErrorStatus = normalizedResponse?.status === 'ERROR';

    if (!hasValidationErrors && !hasErrorStatus) {
        return;
    }

    const validationMessage = hasValidationErrors
        ? errorReports.map((errorReport: { message?: string }) => errorReport.message).filter(Boolean).join(' ')
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
    isMembersFormPage: boolean,
    selectedMembersVisitDate?: string,
    occurredAt?: string,
}) => !isMembersFormPage
|| !selectedMembersVisitDate
    || getOccurredAtDate(occurredAt) === selectedMembersVisitDate;

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
    baseUrl?: string,
    enrollmentId?: string,
    orgUnitId?: string,
    programId?: string,
    teiId?: string,
}) => {
    if (!baseUrl || !enrollmentId || !orgUnitId || !programId || !teiId) {
        return undefined;
    }

    const queryString = buildUrlQueryString({
        enrollmentId,
        orgUnitId,
        programId,
        teiId,
    });

    return `${baseUrl}/dhis-web-capture/index.html#/enrollment?${queryString}`;
};

const getOccurredAtWithCurrentTime = (selectedDate?: string) => {
    const now = moment();
    if (!selectedDate) {
        return now.format('YYYY-MM-DDTHH:mm:ss.SSS');
    }

    const date = moment(selectedDate, ['DD-MM-YYYY', 'YYYY-MM-DD'], true);

    return date
        .set({
            hour: now.hour(),
            minute: now.minute(),
            second: now.second(),
            millisecond: now.millisecond(),
        }).format('YYYY-MM-DDTHH:mm:ss.SSS');
};

const getOccurredAtForSave = ({
    eventId,
    existingOccurredAt,
    selectedMembersVisitDate,
}: {
    eventId?: string,
    existingOccurredAt?: string,
    selectedMembersVisitDate?: string,
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

const revertRecordOverridePatch = ({
    currentOverrides,
    scopeKey,
    rowId,
    columnId,
    existingClientValue,
    eventId,
}: {
    currentOverrides: { [key: string]: { [key: string]: any } },
    scopeKey: string,
    rowId: string,
    columnId: string,
    existingClientValue: any,
    eventId?: string,
}) => {
    const scopedOverrides = currentOverrides[scopeKey] || {};
    const currentRowOverrides = scopedOverrides[rowId] || {};
    const nextRowOverrides = {
        ...currentRowOverrides,
        [columnId]: existingClientValue,
    };

    if (!eventId) {
        delete nextRowOverrides[EVENT_METADATA_KEYS.eventId];
        delete nextRowOverrides[EVENT_METADATA_KEYS.occurredAt];
        delete nextRowOverrides[EVENT_METADATA_KEYS.syntheticForSelectedDate];
    }

    return {
        ...currentOverrides,
        [scopeKey]: {
            ...scopedOverrides,
            [rowId]: nextRowOverrides,
        },
    };
};

const getOverrideScopeKey = ({
    isMembersFormPage,
    selectedMembersVisitDate,
    existingOccurredAt,
}: {
    isMembersFormPage: boolean,
    selectedMembersVisitDate?: string,
    existingOccurredAt?: string,
}) => {
    if (!isMembersFormPage) {
        return DEFAULT_OVERRIDE_SCOPE;
    }

    return selectedMembersVisitDate || getOccurredAtDate(existingOccurredAt) || DEFAULT_OVERRIDE_SCOPE;
};

const getLatestEventByTrackedEntity = (events: Array<any>) =>
    events.reduce((acc, event) => {
        const trackedEntityId = event.trackedEntity;
        if (!trackedEntityId) {
            return acc;
        }

        const currentSelected = acc[trackedEntityId];
        if (!currentSelected) {
            acc[trackedEntityId] = event;
            return acc;
        }

        const currentDate = event.occurredAt || event.scheduledAt || '';
        const selectedDate = currentSelected.occurredAt || currentSelected.scheduledAt || '';
        if (currentDate > selectedDate) {
            acc[trackedEntityId] = event;
        }
        return acc;
    }, {});

const createDataElement = (column) => {
    const dataElement = new DataElement((o) => {
        o.id = column.id;
        o.type = column.type;
    });

    if (column.options) {
        const options = column.options.map(option =>
            new Option((o) => {
                o.text = option.text;
                o.value = option.value;
            }),
        );
        const optionSet = new OptionSet(column.id, options, null, dataElement);
        dataElement.optionSet = optionSet;
    }
    return dataElement;
};

export const useDataSource = (
    records: { [key: string]: any } | undefined,
    recordsOrder: Array<string> | undefined,
    columns: Array<{
        id: string,
        options?: Array<{ text: string, value: any }> | null,
        type: typeof dataElementTypes[keyof typeof dataElementTypes],
        visible: boolean,
        [key: string]: any,
    }>,
    currentProgramStageId?: string,
    program?: any,
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
    const [rowChanged, setRowChanged] = useState<string>('');
    const activeOverrideScopeKey = getOverrideScopeKey({
        isMembersFormPage,
        selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
    });
    const fetchedSelectedDateEventsByTei = useMemo(() => {
        const selectedDateEventsResults = selectedDateEventsData?.results as any;
        const events = selectedDateEventsResults?.events || selectedDateEventsResults?.instances || [];
        return getLatestEventByTrackedEntity(events);
    }, [selectedDateEventsData]);
    const selectedDateEventsByTei = useMemo(() => {
        if (!isMembersFormPage || !selectedMembersVisitDate?.normalized) {
            return undefined;
        }

        return fetchedSelectedDateEventsByTei;
    }, [fetchedSelectedDateEventsByTei, isMembersFormPage, selectedMembersVisitDate?.normalized]);

    const { runRulesEngine } = isMembersFormPage ? CustomDhis2RulesEngine({ program: program._id, type: 'programStage', rowChanged }) : {};
    const rowValueRef = useRef({});
    const { hide, show } = useShowAlerts()

    const eventRecordsArray = useMemo(() =>
        recordsOrder && records && recordsOrder
            .map((id) => {
                const data = {
                    ...records[id],
                    ...(isMembersFormPage && selectedMembersVisitDate?.normalized && selectedDateEventsByTei ? (() => {
                        const selectedDateEvent = selectedDateEventsByTei[records[id]?.[EVENT_METADATA_KEYS.teiId] || id];
                        const selectedDateEventValues = (selectedDateEvent?.dataValues || []).reduce((acc, dataValue) => {
                            acc[dataValue.dataElement] = dataValue.value;
                            return acc;
                        }, {});

                        return {
                            [EVENT_METADATA_KEYS.eventId]: selectedDateEvent?.event,
                            [EVENT_METADATA_KEYS.occurredAt]: selectedDateEvent?.occurredAt,
                            'event_date': selectedMembersVisitDate?.normalized,
                            [EVENT_METADATA_KEYS.syntheticForSelectedDate]: false,
                            ...selectedDateEventValues,
                        };
                    })() : {}),
                    ...((recordOverrides[activeOverrideScopeKey] || {})[id] || {}),
                    id,
                };
                setRowChanged('');
                return data;
            }), [
        records,
        recordsOrder,
        recordOverrides,
        activeOverrideScopeKey,
        isMembersFormPage,
        selectedMembersVisitDate?.normalized,
        selectedDateEventsByTei,
        columns,
    ]);

    React.useEffect(() => {
        if (!isMembersFormPage) {
            setLoadingSelectedDateEvents(false);
            return undefined;
        }

        setLoadingSelectedDateEvents(Boolean(selectedMembersVisitDate?.normalized && selectedDateEventsLoading));

        return () => {
            setLoadingSelectedDateEvents(false);
        };
    }, [isMembersFormPage, selectedDateEventsLoading, selectedMembersVisitDate?.normalized]);

    React.useEffect(() => {
        if (!isMembersFormPage || !selectedMembersVisitDate?.normalized || !recordsOrder?.length || !records) {
            return;
        }

        const firstRecord = records[recordsOrder[0]];
        const programId = firstRecord?.[EVENT_METADATA_KEYS.programId];
        const programStageId = currentProgramStageId || firstRecord?.[EVENT_METADATA_KEYS.programStageId];
        const trackedEntityIds = recordsOrder
            .map(id => records[id]?.[EVENT_METADATA_KEYS.teiId] || id)
            .filter(Boolean);

        if (!programId || !programStageId || !trackedEntityIds.length) {
            return;
        }

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

    const persistEventCellValue = useCallback(async ({
        eventRecord,
        column,
        row
    }: {
        eventRecord: { [key: string]: any },
        column: { id: string, type: keyof typeof dataElementTypes },
        row: any
    }) => {
        const rowId = eventRecord.id;

        if (isMembersFormPage && !selectedMembersVisitDate?.normalized) return;

        const { eventId, teiId, enrollmentId, orgUnitId, programId, programStageId: recordProgramStageId, occurredAt: existingOccurredAt } = getEventMetadata(eventRecord);

        const programStageId = currentProgramStageId || recordProgramStageId;
        const shouldReuseExistingEvent = Boolean(eventId) && hasEventForSelectedDate({
            isMembersFormPage,
            selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
            occurredAt: existingOccurredAt,
        });
        const targetExistingEventId = shouldReuseExistingEvent ? eventId : undefined;
        const targetExistingOccurredAt = shouldReuseExistingEvent ? existingOccurredAt : undefined;

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
                    rowId,
                }),
            );
            return;
        }

        try {
            const { [EVENT_METADATA_KEYS.eventId]: _, ...rest } = rowValueRef?.current?.[row] || {};
            const dataElements = Object.entries(rest)
                .map(([id, value]) => ({
                    dataElement: id,
                    value,
                }));

            const mutationResponse = await saveEventMutation({
                events: [{
                    event: targetEventId,
                    trackedEntity: teiId,
                    enrollment: enrollmentId,
                    orgUnit: orgUnitId,
                    program: programId,
                    programStage: programStageId,
                    status: 'ACTIVE',
                    occurredAt: nextOccurredAt,
                    dataValues: dataElements,
                }],
            });

            if (!eventId) {
                const nextRowValue = {
                    ...rowValueRef.current,
                    [row]: {
                        ...(rowValueRef.current[row] || {}),
                        [EVENT_METADATA_KEYS.eventId]: targetEventId,
                    },
                }
                rowValueRef.current = nextRowValue;
            }

            recordOverride({
                eventRecord,
                column,
                value: { loading: false, ...rowValueRef?.current?.[row] },
                object: true
            })

            show({
                message: `Dados gravados com sucesso`,
                type: { success: true }
            });
            setTimeout(hide, 5000);
            throwIfTrackerMutationFailed(mutationResponse);
        } catch (error) {
            show({
                message: `Ocorreu um erro ao gravar os dados`,
                type: { critical: true }
            });
            setTimeout(hide, 5000);
            return;
        }

        if (!targetExistingEventId) {
            eventRecord[EVENT_METADATA_KEYS.eventId] = targetEventId;
            eventRecord[EVENT_METADATA_KEYS.occurredAt] = nextOccurredAt;
            eventRecord[EVENT_METADATA_KEYS.syntheticForSelectedDate] = true;
        }
    }, [currentProgramStageId, isMembersFormPage, saveEventMutation, selectedMembersVisitDate?.normalized]);

    const recordOverride = ({
        eventRecord,
        column,
        value,
        object = false,
    }: {
        eventRecord: { [key: string]: any },
        column: { id: string, type: keyof typeof dataElementTypes },
        value: any,
        object?: boolean,
    }) => {

        const overrideScopeKey = getOverrideScopeKey({
            isMembersFormPage,
            selectedMembersVisitDate: selectedMembersVisitDate?.normalized,
        });
        const rowId = eventRecord.id;
        setRowChanged(rowId);

        const overridePatch = object ? {
            ...value
        } : {
            [column.id]: value,
        }

        setRecordOverrides(currentOverrides => applyRecordOverridePatch(currentOverrides, overrideScopeKey, rowId, overridePatch));
    };

    return useMemo(() => {
        if (eventRecordsArray) return eventRecordsArray
            .map((eventRecord, rowIndex) => {
                const headers = isMembersFormPage ? runRulesEngine!({ overrideValues: eventRecord, overrideVariables: columns, idx: rowIndex }) : columns;
                const uid = uuid();
                runRulesForNewEvent({})
                startRunRulesPostUpdateField('enrollmentEvent', 'newEvent', uid),

                    executeRulesOnUpdateForNewEvent({ ...innerAction.payload, uid, rulesExecutionDependenciesClientFormatted }),
                // console.log(headers)
                const listRecord = columns
                    .filter(column => column.visible)
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
                                    {
                                        href: captureEnrollmentUrl,
                                        target: '_blank',
                                        rel: 'noopener noreferrer',
                                    },
                                    React.createElement(Button, { small: true }, 'Detalhes'),
                                )
                                : null;
                            return acc;
                        }

                        if (isMembersFormPage && id === 'actions') {
                            acc[id] = React.createElement(
                                'div',
                                { style: { display: 'flex', gap: '8px' } },
                                React.createElement(
                                    Button,
                                    {
                                        small: true,
                                        loading: eventRecord?.loading,
                                        disabled: !Boolean(rowValueRef.current?.[rowIndex]),
                                        onClick: () => {
                                            const required: any = headers?.filter(x => x.required)
                                            const error: any = headers?.filter(x => x.error)

                                            const conjunto = [...error, ...required]

                                            if (required?.length > 0 || error?.length > 0)
                                                for (let req of conjunto) {
                                                    if (!eventRecord[req.id]) {
                                                        show({
                                                            message: `O campo "${req?.header}" é obrigatório!`,
                                                            type: { warning: true }
                                                        });
                                                        setTimeout(hide, 5000);

                                                        return;
                                                    }
                                                }

                                            recordOverride({ eventRecord, column, value: { loading: true }, object: true })
                                            void persistEventCellValue({ eventRecord, column, row: rowIndex })
                                        }
                                    },
                                    '💾 Gravar'
                                )
                            )

                            return acc;
                        }

                        if (isMembersFormPage && column.additionalColumn) {
                            const thisHeader = headers?.find(x => x.id == column.id);
                            acc[id] = React.createElement(InlineEventCellField, {
                                key: `${eventRecord.id}-${id}`,
                                column: thisHeader,
                                value: clientValue,
                                ...((isMembersFormLocked || eventRecord.loading) ? { disabled: (isMembersFormLocked || eventRecord.loading) } : {}),
                                saveStatus: 'idle',
                                onCommit: (nextClientValue: any) => {
                                    recordOverride({ eventRecord, column, value: nextClientValue })

                                    const nextRowValue = {
                                        ...rowValueRef.current,
                                        [rowIndex]: {
                                            ...(rowValueRef.current[rowIndex] || {}),
                                            [column.id]: nextClientValue,
                                        },
                                    }
                                    rowValueRef.current = nextRowValue;
                                },
                            });
                            return acc;
                        }

                        if (resolveValue) {
                            acc[id] = resolveValue()[clientValue];
                        } else if (options) {
                            if (type === dataElementTypes.MULTI_TEXT) {
                                const dataElement = createDataElement(column);
                                acc[id] = convertClientToList(clientValue, type, dataElement);
                            } else {
                                // TODO: Need is equal comparer for types because `sourceValue` and `option` can be an object
                                // for example (for some data element types) and we can't do strict comparison.
                                const option = options.find(o => o.value === clientValue);
                                if (!option) {
                                    log.error(
                                        errorCreator('Missing value in options')({ id, clientValue, options }),
                                    );
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

                return {
                    ...listRecord,
                    id: eventRecord.id, // used as rowkey
                };
            })
    }, [
        eventRecordsArray,
        columns,
        baseUrl,
        isMembersFormPage,
        isMembersFormLocked,
        persistEventCellValue,
    ]);
};