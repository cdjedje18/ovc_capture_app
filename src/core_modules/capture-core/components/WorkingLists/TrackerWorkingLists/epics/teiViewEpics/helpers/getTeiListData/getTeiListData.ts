import { handleAPIResponse, REQUESTED_ENTITIES } from 'capture-core/utils/api';
import { featureAvailable, FEATURES, errorCreator } from 'capture-core-utils';
import log from 'loglevel';
import { convertServerToClient } from '../../../../../../../converters';
import { convertToClientTeis } from './convertToClientTeis';
import {
    getSubvalues,
    getApiFilterQueryArgs,
    getMainApiFilterQueryArgs,
    getOrderQueryArgs,
    buildUrlByElementType,
    RECORD_TYPE,
} from '../getListDataCommon';
import { getFilterApiName } from '../../../../helpers';
import type { RawQueryArgs } from './types';
import type { InputMeta } from './getTeiListData.types';
import type { TeiColumnsMetaForDataFetching, TeiFiltersOnlyMetaForDataFetching } from '../../../../types';

const RECORD_META_KEYS = {
    programStageId: '__programStageId',
    eventId: '__eventId',
} as const;

export const createApiQueryArgs = ({
    page,
    pageSize,
    programId: program,
    orgUnitId,
    filters,
    sortById,
    sortByDirection,
}: RawQueryArgs,
columnsMetaForDataFetching: TeiColumnsMetaForDataFetching,
filtersOnlyMetaForDataFetching: TeiFiltersOnlyMetaForDataFetching,
): { [key: string]: any } => {
    const orgUnitModeQueryParam: string = featureAvailable(FEATURES.newOrgUnitModeQueryParam)
        ? 'orgUnitMode'
        : 'ouMode';

    const orgUnitQueryParam: string = featureAvailable(FEATURES.newEntityFilterQueryParam)
        ? 'orgUnits'
        : 'orgUnit';

    return {
        ...getApiFilterQueryArgs(filters, filtersOnlyMetaForDataFetching),
        ...getMainApiFilterQueryArgs(filters, filtersOnlyMetaForDataFetching),
        order: getOrderQueryArgs({ sortById, sortByDirection, withAPINameConverter: true }),
        page,
        pageSize,
        [orgUnitQueryParam]: orgUnitId,
        [orgUnitModeQueryParam]: orgUnitId ? 'SELECTED' : 'ACCESSIBLE',
        program,
        fields: ':all,!relationships,programOwners[orgUnit,program]',
    };
};

const createEventsQueryArgsForTeis = (
    {
        programId,
        programStageId,
    }: RawQueryArgs,
    trackedEntityIds: string,
) => {
    const trackedEntitiesQueryParam: string = featureAvailable(FEATURES.newEntityFilterQueryParam)
        ? 'trackedEntities'
        : 'trackedEntity';

    return {
        program: programId,
        programStage: programStageId,
        pageSize: 10000,
        order: 'occurredAt:desc',
        [trackedEntitiesQueryParam]: trackedEntityIds,
        fields: 'event,trackedEntity,status,occurredAt,scheduledAt,orgUnit,assignedUser,dataValues[dataElement,value]',
    };
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

const mergeEventValuesIntoTeis = ({
    clientTeis,
    events,
    columnsMetaForDataFetchingArray,
    programStageId,
}: {
    clientTeis: Array<any>,
    events: Array<any>,
    columnsMetaForDataFetchingArray: Array<any>,
    programStageId?: string,
}) => {
    const additionalColumns = columnsMetaForDataFetchingArray.filter(column => column.additionalColumn);
    const latestEventsByTei = getLatestEventByTrackedEntity(events);

    return clientTeis.map((tei) => {
        const event = latestEventsByTei[tei.id];

        const recordWithMeta = {
            ...tei.record,
            [RECORD_META_KEYS.programStageId]: programStageId,
            [RECORD_META_KEYS.eventId]: event?.event,
        };
        if (!event || !additionalColumns.length) {
            return {
                ...tei,
                record: recordWithMeta,
            };
        }

        const dataValuesById = (event.dataValues || []).reduce((acc, dataValue) => {
            acc[dataValue.dataElement] = dataValue.value;
            return acc;
        }, {});

        const additionalRecord = additionalColumns.reduce((acc, column) => {
            const { id, mainProperty, type } = column;
            const eventPropertyName = mainProperty ? getFilterApiName(id) : id;
            const rawValue = mainProperty ? event[eventPropertyName] : dataValuesById[id];
            if (rawValue == null) {
                return acc;
            }

            const urls = buildUrlByElementType[RECORD_TYPE.event][type]
                ? buildUrlByElementType[RECORD_TYPE.event][type]({ event: event.event, id })
                : {};

            acc[id] = {
                convertedValue: convertServerToClient(rawValue, type),
                fileUrl: urls.fileUrl,
                ...(urls.imageUrl ? { imageUrl: urls.imageUrl, previewUrl: urls.previewUrl } : {}),
            };
            return acc;
        }, {});

        return {
            ...tei,
            record: {
                ...recordWithMeta,
                ...additionalRecord,
            },
        };
    });
};

export const getTeiListData = async (
    rawQueryArgs: RawQueryArgs, {
        columnsMetaForDataFetching,
        filtersOnlyMetaForDataFetching,
        querySingleResource,
        absoluteApiPath,
    }: InputMeta,
) => {
    const { url, queryParams } = {
        url: 'tracker/trackedEntities',
        queryParams: createApiQueryArgs(rawQueryArgs, columnsMetaForDataFetching, filtersOnlyMetaForDataFetching),
    };

    const apiResponse = await querySingleResource({
        resource: url,
        params: queryParams,
    });
    const apiTrackedEntities = handleAPIResponse(REQUESTED_ENTITIES.trackedEntities, apiResponse);
    const columnsMetaForDataFetchingArray = [...columnsMetaForDataFetching.values()];
    const clientTeis = convertToClientTeis(apiTrackedEntities, columnsMetaForDataFetchingArray, rawQueryArgs.programId);

    let enrichedClientTeis = clientTeis;
    const { programStageId } = rawQueryArgs;
    if (programStageId && clientTeis.length > 0) {
        const useNewSeparator = featureAvailable(FEATURES.newUIDsSeparator);
        const trackedEntityIds = clientTeis
            .map(({ id }) => id)
            .filter(Boolean)
            .join(useNewSeparator ? ',' : ';');

        if (trackedEntityIds) {
            try {
                const eventsApiResponse = await querySingleResource({
                    resource: 'tracker/events',
                    params: createEventsQueryArgsForTeis(rawQueryArgs, trackedEntityIds),
                });
                const apiEvents = handleAPIResponse(REQUESTED_ENTITIES.events, eventsApiResponse);
                enrichedClientTeis = mergeEventValuesIntoTeis({
                    clientTeis,
                    events: apiEvents,
                    columnsMetaForDataFetchingArray,
                    programStageId,
                });
            } catch (error) {
                log.warn(errorCreator('Could not enrich TEI list with event values')({ error, programStageId }));
                enrichedClientTeis = clientTeis;
            }
        }
    }

    enrichedClientTeis = enrichedClientTeis.map(tei => ({
        ...tei,
        record: {
            ...tei.record,
            [RECORD_META_KEYS.programStageId]: rawQueryArgs.programStageId,
        },
    }));

    const clientTeisWithSubvalues = await getSubvalues(querySingleResource, absoluteApiPath)(
        enrichedClientTeis,
        columnsMetaForDataFetchingArray,
    );

    return {
        recordContainers: clientTeisWithSubvalues,
        request: {
            url,
            queryParams,
        },
    };
};
