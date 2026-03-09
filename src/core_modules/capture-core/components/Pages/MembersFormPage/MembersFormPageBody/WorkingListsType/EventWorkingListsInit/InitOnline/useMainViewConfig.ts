/* eslint-disable complexity */
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import log from 'loglevel';
import { errorCreator } from 'capture-core-utils';
import { useEffect } from 'react';
import { useApiMetadataQuery } from '../../../../../../../utils/reactQueryHelpers';
import type { DataStoreDataEntry, DataStoreWorkingLists, UseMainViewConfig } from './useMainViewConfig.types';

export const useMainViewConfig: UseMainViewConfig = () => {
    const {
        data: captureKeys,
        isLoading: namespaceIsLoading,
        isError: namespaceIsError,
        error: namespaceError,
    } = useApiMetadataQuery<any>(
        ['dataStore', 'capture'], {
            resource: 'dataStore/capture',
        }, {
            select: (namespaceKeys: Array<string> | null | undefined) => namespaceKeys ?? [],
        });

    const { data: mainViewConfig, isInitialLoading, isError, error } = useApiMetadataQuery<any>(
        ['dataStore', 'workingListsEvents'], {
            resource: 'dataStore/capture/workingLists',
        }, {
            enabled: captureKeys?.includes('workingLists'),
            select: (workingLists: DataStoreWorkingLists) => {
                // only adding support for relative event date as of now
                // we should use Zod here long-term to properly validate the structure of the object
                // and give error messages to the user
                if (workingLists?.version !== 1) {
                    return undefined;
                }
                const occurredAt = workingLists?.global?.event?.mainView?.occurredAt;
                if (
                    !occurredAt ||
                    !isObject(occurredAt) ||
                    occurredAt.type !== 'RELATIVE'
                ) {
                    return undefined;
                }
                // The general idea is that the return value here should have the same data structure
                // as the response from the working lists api

                if (occurredAt.period) {
                    if (['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR', 'LAST_WEEK', 'LAST_MONTH', 'LAST_3_MONTHS']
                        .includes(occurredAt.period)
                    ) {
                        return {
                            eventDate: {
                                type: occurredAt.type,
                                period: occurredAt.period,
                                startBuffer: 0,
                                endBuffer: 0,
                                lockedAll: !!occurredAt.lockedInAllViews,
                            },
                        };
                    }
                } else {
                    if ((occurredAt.startBuffer && !isNumber(occurredAt.startBuffer)) ||
                        (occurredAt.endBuffer && !isNumber(occurredAt.endBuffer)) ||
                        (!occurredAt.startBuffer && !occurredAt.endBuffer)) {
                        return undefined;
                    }
                    return {
                        eventDate: {
                            type: occurredAt.type,
                            startBuffer: occurredAt.startBuffer,
                            endBuffer: occurredAt.endBuffer,
                            lockedAll: !!occurredAt.lockedInAllViews,
                        },
                    };
                }
                return undefined;
            },
        },
    );

    const {
        data: dataEntryPrograms,
        isInitialLoading: dataEntryIsInitialLoading,
        isError: dataEntryIsError,
        error: dataEntryError,
    } = useApiMetadataQuery<any>(
        ['dataStore', 'ovc_capture_app'], {
            resource: 'dataStore/ovc_capture_app/data_entry',
        }, {
            enabled: captureKeys?.includes('data_entry'),
            select: (dataEntryConfig: DataStoreDataEntry) =>
                (dataEntryConfig?.programs ?? [])
                    .filter(({ program, programStage }) => isString(program) && isString(programStage))
                    .map(({ program, programStage }) => ({
                        program: program as string,
                        programStage: programStage as string,
                    })),
        },
    );

    useEffect(() => {
        if (namespaceIsError) {
            log.error(
                errorCreator(
                    'capture namespace could not be fetched from the datastore')({ error }),
            );
        }
        if (isError) {
            log.error(
                errorCreator(
                    'workingLists key could not be fetched from the datastore')({ error }),
            );
        }
        if (dataEntryIsError) {
            log.error(
                errorCreator(
                    'data_entry key could not be fetched from the datastore')({ error: dataEntryError }),
            );
        }
    }, [isError, error, namespaceIsError, namespaceError, dataEntryIsError, dataEntryError]);

    return {
        mainViewConfig,
        dataEntryPrograms,
        mainViewConfigReady: !namespaceIsLoading && !isInitialLoading && !dataEntryIsInitialLoading,
    };
};
