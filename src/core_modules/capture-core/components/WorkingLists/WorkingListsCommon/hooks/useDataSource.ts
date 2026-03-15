import React, { useCallback, useMemo, useState } from 'react';
import moment from 'moment';
import { useConfig, useDataMutation } from '@dhis2/app-runtime';
import { Button } from '@dhis2/ui';
import log from 'loglevel';
import { errorCreator } from 'capture-core-utils';
import type { Mutation } from 'capture-core-utils/types/app-runtime';
import { dataElementTypes, DataElement, OptionSet, Option } from '../../../../metaData';
import { convertClientToList, convertClientToServer } from '../../../../converters';
import { generateUID } from '../../../../utils/uid/generateUID';
import { buildUrlQueryString } from '../../../../utils/routing';
import { isMembersFormPage as isMembersFormPageRoute } from '../../utils/isMembersFormPage';
import { useSelectedMembersVisitDate } from '../../WorkingListsBase/membersVisitDate.store';
import { InlineEventCellField } from './InlineEventCellField.component';
import { MEMBERS_CAPTURE_LINK_COLUMN_ID } from '../../TrackerWorkingLists/Setup/hooks/useDefaultColumnConfig';

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
} as const;

const getEventMetadata = (eventRecord: { [key: string]: any }) => ({
    eventId: eventRecord[EVENT_METADATA_KEYS.eventId],
    teiId: eventRecord[EVENT_METADATA_KEYS.teiId],
    enrollmentId: eventRecord[EVENT_METADATA_KEYS.enrollmentId],
    orgUnitId: eventRecord[EVENT_METADATA_KEYS.orgUnitId],
    programId: eventRecord[EVENT_METADATA_KEYS.programId],
    programStageId: eventRecord[EVENT_METADATA_KEYS.programStageId],
    occurredAt: eventRecord[EVENT_METADATA_KEYS.occurredAt],
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

    const normalizedDate = selectedDate.slice(0, 10);
    return moment(
        `${normalizedDate}T${now.format('HH:mm:ss.SSS')}`,
        'YYYY-MM-DDTHH:mm:ss.SSS',
    ).format('YYYY-MM-DDTHH:mm:ss.SSS');
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
    currentOverrides: { [key: string]: any },
    rowId: string,
    patch: { [key: string]: any },
) => ({
    ...currentOverrides,
    [rowId]: {
        ...(currentOverrides[rowId] || {}),
        ...patch,
    },
});

const revertRecordOverridePatch = ({
    currentOverrides,
    rowId,
    columnId,
    existingClientValue,
    eventId,
}: {
    currentOverrides: { [key: string]: any },
    rowId: string,
    columnId: string,
    existingClientValue: any,
    eventId?: string,
}) => {
    const currentRowOverrides = currentOverrides[rowId] || {};
    const nextRowOverrides = {
        ...currentRowOverrides,
        [columnId]: existingClientValue,
    };

    if (!eventId) {
        delete nextRowOverrides[EVENT_METADATA_KEYS.eventId];
        delete nextRowOverrides[EVENT_METADATA_KEYS.occurredAt];
    }

    return {
        ...currentOverrides,
        [rowId]: nextRowOverrides,
    };
};

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
) => {
    const isMembersFormPage = isMembersFormPageRoute();
    const selectedMembersVisitDate = useSelectedMembersVisitDate();
    const isMembersFormLocked = isMembersFormPage && !selectedMembersVisitDate;
    const { baseUrl } = useConfig();
    const [saveEventMutation] = useDataMutation(TRACKER_EVENT_MUTATION);
    const [recordOverrides, setRecordOverrides] = useState<{ [key: string]: any }>({});
    const eventRecordsArray = useMemo(() =>
        recordsOrder && records && recordsOrder
            .map(id => ({
                ...records[id],
                ...(recordOverrides[id] || {}),
                id,
            })), [
        records,
        recordsOrder,
        recordOverrides,
    ]);

    const persistEventCellValue = useCallback(async ({
        eventRecord,
        column,
        nextClientValue,
    }: {
        eventRecord: { [key: string]: any },
        column: { id: string, type: keyof typeof dataElementTypes },
        nextClientValue: any,
    }) => {
        const existingClientValue = eventRecord[column.id];
        if (existingClientValue === nextClientValue) {
            return;
        }
        if (isMembersFormPage && !selectedMembersVisitDate) {
            return;
        }

        const {
            eventId,
            teiId,
            enrollmentId,
            orgUnitId,
            programId,
            programStageId,
            occurredAt: existingOccurredAt,
        } = getEventMetadata(eventRecord);

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

        const serverValue = nextClientValue === ''
            ? ''
            : convertClientToServer(nextClientValue, column.type);
        const targetEventId = eventId || generateUID();
        const nextOccurredAt = getOccurredAtForSave({
            eventId,
            existingOccurredAt,
            selectedMembersVisitDate,
        });
        const rowId = eventRecord.id;

        if (eventId && !nextOccurredAt) {
            log.warn(
                errorCreator('Could not save existing event because occurredAt is missing')({
                    eventId,
                    columnId: column.id,
                    rowId,
                }),
            );
            return;
        }

        const overridePatch = {
            [column.id]: nextClientValue,
            ...(!eventId ? {
                [EVENT_METADATA_KEYS.eventId]: targetEventId,
                [EVENT_METADATA_KEYS.occurredAt]: nextOccurredAt,
            } : {}),
        };

        setRecordOverrides(currentOverrides => applyRecordOverridePatch(currentOverrides, rowId, overridePatch));

        try {
            await saveEventMutation({
                events: [{
                    event: targetEventId,
                    trackedEntity: teiId,
                    enrollment: enrollmentId,
                    orgUnit: orgUnitId,
                    program: programId,
                    programStage: programStageId,
                    status: 'ACTIVE',
                    occurredAt: nextOccurredAt,
                    dataValues: [{
                        dataElement: column.id,
                        value: serverValue,
                    }],
                }],
            });
        } catch (error) {
            setRecordOverrides(currentOverrides => revertRecordOverridePatch({
                currentOverrides,
                rowId,
                columnId: column.id,
                existingClientValue,
                eventId,
            }));
            throw error;
        }

        if (!eventId) {
            eventRecord[EVENT_METADATA_KEYS.eventId] = targetEventId;
            eventRecord[EVENT_METADATA_KEYS.occurredAt] = nextOccurredAt;
        }
    }, [isMembersFormPage, saveEventMutation, selectedMembersVisitDate]);

    return useMemo(() => eventRecordsArray && eventRecordsArray
        .map((eventRecord) => {
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

                    if (isMembersFormPage && column.additionalColumn) {
                        acc[id] = React.createElement(InlineEventCellField, {
                            key: `${eventRecord.id}-${id}`,
                            column,
                            value: clientValue,
                            disabled: isMembersFormLocked,
                            onCommit: (nextClientValue: any) => {
                                persistEventCellValue({
                                    eventRecord,
                                    column,
                                    nextClientValue,
                                }).catch((error) => {
                                    log.error(
                                        errorCreator('Could not persist inline event value')({
                                            error,
                                            columnId: id,
                                            rowId: eventRecord.id,
                                        }),
                                    );
                                });
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
                                    errorCreator(
                                        'Missing value in options')(
                                        { id, clientValue, options }),
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
        }), [
        eventRecordsArray,
        columns,
        baseUrl,
        isMembersFormPage,
        isMembersFormLocked,
        persistEventCellValue,
    ]);
};
