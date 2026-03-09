import React, { useCallback, useMemo } from 'react';
import moment from 'moment';
import { useDataMutation } from '@dhis2/app-runtime';
import log from 'loglevel';
import { errorCreator } from 'capture-core-utils';
import { dataElementTypes, DataElement, OptionSet, Option } from '../../../../metaData';
import { convertClientToList, convertClientToServer } from '../../../../converters';
import { generateUID } from '../../../../utils/uid/generateUID';
import { isMembersFormPage as isMembersFormPageRoute } from '../../utils/isMembersFormPage';
import { useSelectedMembersVisitDate } from '../../WorkingListsBase/membersVisitDate.store';
import { InlineEventCellField } from './InlineEventCellField.component';

const TRACKER_EVENT_MUTATION = {
    resource: 'tracker?async=false&importStrategy=CREATE_AND_UPDATE',
    type: 'create',
    data: payload => payload,
};

const EVENT_METADATA_KEYS = {
    eventId: '__eventId',
    teiId: '__teiId',
    enrollmentId: '__enrollmentId',
    orgUnitId: '__orgUnitId',
    programId: '__programId',
    programStageId: '__programStageId',
} as const;

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
    const [saveEventMutation] = useDataMutation(TRACKER_EVENT_MUTATION);
    const eventRecordsArray = useMemo(() =>
        recordsOrder && records && recordsOrder
            .map(id => ({
                ...records[id],
                id,
            })), [
        records,
        recordsOrder,
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

        const eventId = eventRecord[EVENT_METADATA_KEYS.eventId];
        const teiId = eventRecord[EVENT_METADATA_KEYS.teiId];
        const enrollmentId = eventRecord[EVENT_METADATA_KEYS.enrollmentId];
        const orgUnitId = eventRecord[EVENT_METADATA_KEYS.orgUnitId];
        const programId = eventRecord[EVENT_METADATA_KEYS.programId];
        const programStageId = eventRecord[EVENT_METADATA_KEYS.programStageId];

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

        await saveEventMutation({
            events: [{
                event: targetEventId,
                trackedEntity: teiId,
                enrollment: enrollmentId,
                orgUnit: orgUnitId,
                program: programId,
                programStage: programStageId,
                status: 'ACTIVE',
                occurredAt: selectedMembersVisitDate || moment().format('YYYY-MM-DD'),
                dataValues: [{
                    dataElement: column.id,
                    value: serverValue,
                }],
            }],
        });

        if (!eventId) {
            eventRecord[EVENT_METADATA_KEYS.eventId] = targetEventId;
        }
    }, [isMembersFormPage, saveEventMutation, selectedMembersVisitDate]);

    return useMemo(() => eventRecordsArray && eventRecordsArray
        .map((eventRecord) => {
            const listRecord = columns
                .filter(column => column.visible)
                .reduce((acc, column) => {
                    const { id, type, options, resolveValue } = column;
                    const clientValue = eventRecord[id];
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
        isMembersFormPage,
        isMembersFormLocked,
        persistEventCellValue,
    ]);
};
