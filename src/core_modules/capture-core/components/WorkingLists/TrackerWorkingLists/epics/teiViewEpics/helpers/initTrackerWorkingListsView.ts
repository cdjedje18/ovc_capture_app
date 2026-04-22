import log from 'loglevel';
import i18n from '@dhis2/d2-i18n';
import { errorCreator } from 'capture-core-utils';
import { getTeiListData } from './getTeiListData';
import { getEventListData } from './getEventListData';
import {
    initListViewSuccess,
    initListViewError,
    buildFilterQueryArgs,
} from '../../../../WorkingListsCommon';
import type { Input } from './initTrackerWorkingListsView.types';
import { convertToClientConfig } from '../../../helpers/TEIFilters';
import { isMembersFormPage as isMembersFormPageRoute } from '../../../../utils/isMembersFormPage';

export const initTrackerWorkingListsViewAsync = async ({
    programId,
    programStageId: contextProgramStageId,
    orgUnitId,
    storeId,
    selectedTemplate,
    columnsMetaForDataFetching,
    filtersOnlyMetaForDataFetching,
    querySingleResource,
    absoluteApiPath,
}: Input) => {
    const clientConfig = await convertToClientConfig(
        selectedTemplate,
        columnsMetaForDataFetching,
        querySingleResource,
    );
    const { currentPage, rowsPerPage, sortById, sortByDirection, filters, customColumnOrder } = clientConfig;
    const apiFilters = buildFilterQueryArgs(filters, {
        columns: columnsMetaForDataFetching,
        filtersOnly: filtersOnlyMetaForDataFetching,
        storeId,
        isInit: true,
    });

    const rawQueryArgs = {
        programId,
        orgUnitId,
        pageSize: rowsPerPage,
        page: currentPage,
        sortById,
        sortByDirection,
        filters: apiFilters,
    };
    const params = { columnsMetaForDataFetching, filtersOnlyMetaForDataFetching, querySingleResource, absoluteApiPath };
    const programStageId = selectedTemplate?.criteria?.programStage || contextProgramStageId;
    const isMembersFormPage = isMembersFormPageRoute();
    const shouldUseEventList = !!programStageId && !isMembersFormPage;
    const promiseToGetRecordsList = shouldUseEventList
        ? getEventListData({ ...rawQueryArgs, programStageId }, params)
        : getTeiListData({ ...rawQueryArgs, programStageId }, params);

    return promiseToGetRecordsList
        .then(({ recordContainers, request }) =>
            initListViewSuccess(storeId, {
                recordContainers,
                pagingData: {
                    rowsPerPage,
                    currentPage,
                },
                request,
                config: {
                    sortById,
                    sortByDirection,
                    filters,
                    selections: {
                        programId,
                        orgUnitId,
                    },
                    customColumnOrder,
                },
                context: {
                    programStageId,
                },
            }),
        )
        .catch((error) => {
            log.error(errorCreator('An error occurred when initializing the working list view')({ error }));
            return initListViewError(storeId, i18n.t('Working list could not be loaded'));
        });
};
